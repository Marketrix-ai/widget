/**
 * React context owning the widget's chat store and its live SSE wiring, reached through
 * `useChatContext` (throws outside `ChatProvider`).
 *
 * `ChatProvider` holds the committed `{messages, task}` state and wires the `StreamClient` singleton
 * to it. `messageDispatch` sends a chat turn and waits for the reply over SSE. `stopTask` cancels a
 * running turn. The stream handlers dedupe a resent `tool/call`, run browser tools the agent asks for
 * and reply with their result, and clear a stale connection error once the stream recovers.
 *
 * A dropped connection always reconnects to a fresh, empty queue — the api never replays a chat_id's
 * past events over SSE, so `chat/delta`/`chat/response` need no dedupe here.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useLatest } from '../hooks/useLatest';
import type { WidgetEvent } from '../sdk';
import { browserToolService } from '../services/BrowserToolService';
import { chatPost } from '../services/ChatService';
import { storageService } from '../services/StorageService';
import { streamClient, StreamGaveUpError } from '../services/StreamClient';
import type { ChatMessage, InstructionType } from '../types';
import { CHAT_FAILURE_TEXT, createAgentMessage, createPlaceholderMessage, createUserMessage } from '../utils/chat';
import { logWarn } from '../utils/log';
import {
  isTerminalTaskStatus,
  reduceDispatch,
  reduceError,
  reduceSse,
  reduceStaleReply,
  reduceStop,
  reduceToolDone,
  reduceToolProgress,
  reduceTransportFailure,
  type SseEffect,
  type SseState,
  type TaskState,
} from './sseReducer';
import { useUIStateContext } from './UIStateContext';

interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  messageDispatch: (content: string, mode?: InstructionType, skipUserMessage?: boolean) => Promise<boolean>;
}

interface TaskActions {
  resetTask: () => void;
  stopTask: () => Promise<void>;
}

interface ChatContextType {
  messages: ChatMessage[];
  chatActions: ChatActions;
  taskState: TaskState;
  taskActions: TaskActions;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const MAX_PROCESSED_TOOL_CALL_IDS = 1000;

const STALE_REPLY_TIMEOUT_MS = 120_000;
const STALE_REPLY_TEXT = 'This is taking longer than expected. Please try again.';

interface ChatProviderProps {
  children: React.ReactNode;
  previewMode?: boolean;
}

function createStreamEffectHandlers(deps: {
  commit: (transition: (s: SseState) => SseState) => void;
  currentModeRef: React.RefObject<InstructionType>;
  setError: (message: string | undefined) => void;
  processedToolCallIds: React.RefObject<Set<string>>;
  currentErrorRef: React.RefObject<string | undefined>;
  lastStreamErrorRef: React.RefObject<string | undefined>;
}) {
  const { commit, currentModeRef, setError, processedToolCallIds, currentErrorRef, lastStreamErrorRef } = deps;

  const startToolCall = async ({ call, mode }: SseEffect) => {
    const explanation = call.explanation ?? '';
    const result = await browserToolService.executeTool(call.browser_tool, call.args, mode, explanation);
    const error = result.success ? undefined : result.error;

    commit(s =>
      reduceToolProgress(
        s,
        call.browser_tool,
        explanation,
        error ? 'failed' : 'completed',
        currentModeRef.current,
        error,
      ),
    );
    if (!error && call.browser_tool === 'done') {
      const { success } = call.args;
      commit(s => reduceToolDone(s, currentModeRef.current, success));
    }

    await streamClient
      .send({
        type: 'tool/response',
        tool_call_id: call.tool_call_id,
        success: result.success,
        ...(result.success && { data: JSON.stringify(result.data) }),
        error,
      })
      .catch((err: unknown) => {
        console.error('Failed to send tool response:', err);
        setError('Could not report that step back to the assistant — it may stop responding.');
      });

    if (result.success) result.afterResponseAttempt?.();
  };

  const handleMessage = (event: WidgetEvent): void => {
    if (event.type === 'tool/call') {
      const toolCallId = event.tool_call_id;
      if (processedToolCallIds.current.has(toolCallId)) return;
      processedToolCallIds.current.add(toolCallId);
      if (processedToolCallIds.current.size > MAX_PROCESSED_TOOL_CALL_IDS) {
        processedToolCallIds.current = new Set(
          [...processedToolCallIds.current].slice(-MAX_PROCESSED_TOOL_CALL_IDS / 2),
        );
      }
    } else if (event.type === 'task/status' && isTerminalTaskStatus(event.status)) {
      processedToolCallIds.current.clear();
    } else if (event.type === 'chat/error') {
      logWarn('[Widget] Chat error from server:', event.error);
    } else if (
      event.type === 'registered' &&
      lastStreamErrorRef.current !== undefined &&
      currentErrorRef.current === lastStreamErrorRef.current
    ) {
      lastStreamErrorRef.current = undefined;
      setError(undefined);
    }

    let effects: SseEffect[] = [];
    commit(state => {
      const result = reduceSse(state, event, currentModeRef.current);
      effects = result.effects;
      return result.state;
    });

    for (const effect of effects) {
      startToolCall(effect).catch((error: unknown) => {
        console.error('[Widget] Tool call failed:', error);
        setError('Something went wrong running that step. Please try again.');
      });
    }
  };

  const handleError = (error: Error) => {
    setError(error.message);
    lastStreamErrorRef.current = error.message;
    if (error instanceof StreamGaveUpError) commit(s => reduceTransportFailure(s, error.message));
  };

  return { handleMessage, handleError };
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children, previewMode = false }) => {
  const { uiState, uiActions } = useUIStateContext();
  const [state, setState] = useState<SseState>(() => ({ messages: [], task: { phase: 'idle' } }));

  const stateRef = useRef<SseState>(state);

  const currentModeRef = useLatest(uiState.currentMode);

  const processedToolCallIds = useRef(new Set<string>());
  const currentErrorRef = useLatest(uiState.error);
  const lastStreamErrorRef = useRef<string | undefined>(undefined);

  const commit = useCallback((transition: (s: SseState) => SseState) => {
    const prev = stateRef.current;
    const next = transition(prev);
    if (next === prev || (next.messages === prev.messages && next.task === prev.task)) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const addMessage = useCallback(
    (message: ChatMessage) => {
      commit(s => ({ ...s, messages: [...s.messages, message] }));
    },
    [commit],
  );

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      commit(s => ({
        ...s,
        messages: s.messages.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg)),
      }));
    },
    [commit],
  );

  const removeMessage = useCallback(
    (messageId: string) => {
      commit(s => ({ ...s, messages: s.messages.filter(msg => msg.id !== messageId) }));
    },
    [commit],
  );

  const setMessages = useCallback(
    (messages: ChatMessage[]) => {
      commit(s => ({ ...s, messages }));
    },
    [commit],
  );

  const clearMessages = useCallback(() => {
    commit(s => ({ ...s, messages: [] }));
  }, [commit]);

  const resetTask = useCallback(() => {
    commit(s => ({ ...s, task: { phase: 'idle' } }));
  }, [commit]);

  const pendingReplies = state.messages
    .filter(msg => msg.isPlaceholder)
    .map(msg => `${msg.id}:${msg.parts.length}`)
    .join(' ');

  useEffect(() => {
    const watchdogs = pendingReplies
      .split(' ')
      .filter(Boolean)
      .map(entry => entry.split(':')[0])
      .filter((id): id is string => id !== undefined)
      .map(id => setTimeout(() => commit(s => reduceStaleReply(s, id, STALE_REPLY_TEXT)), STALE_REPLY_TIMEOUT_MS));

    return () => watchdogs.forEach(clearTimeout);
  }, [pendingReplies, commit]);

  const messageDispatch = useCallback(
    async (content: string, mode?: InstructionType, skipUserMessage?: boolean): Promise<boolean> => {
      const effectiveMode = mode ?? currentModeRef.current;

      if (previewMode) {
        if (!skipUserMessage) {
          addMessage(createUserMessage(content, effectiveMode));
        }
        addMessage(createAgentMessage("This is a preview. In production, I'll respond to your messages here."));
        return true;
      }

      const config = storageService.getCredentialedConfig();

      if (!config) {
        console.error('Config not loaded or incomplete');
        addMessage(
          createAgentMessage('Configuration error: Missing API credentials. Please check your widget settings.'),
        );
        return false;
      }

      if (!skipUserMessage) {
        addMessage(createUserMessage(content, effectiveMode));
      }

      const placeholder = createPlaceholderMessage(effectiveMode);
      commit(s => reduceDispatch(s, placeholder));

      try {
        await chatPost(content, effectiveMode, placeholder.id);
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        commit(s => reduceError(s, placeholder.id, CHAT_FAILURE_TEXT));
        return false;
      }
    },
    [previewMode, addMessage, commit, currentModeRef],
  );

  useEffect(() => {
    if (previewMode) return;

    const { handleMessage, handleError } = createStreamEffectHandlers({
      commit,
      currentModeRef,
      setError: uiActions.setError,
      processedToolCallIds,
      currentErrorRef,
      lastStreamErrorRef,
    });
    const callbacks = { onMessage: handleMessage, onError: handleError };
    streamClient.addCallbacks(callbacks);

    return () => {
      streamClient.removeCallbacks(callbacks);
    };
  }, [previewMode, commit, uiActions, currentModeRef, currentErrorRef]);

  const stopTask = useCallback(async () => {
    commit(s => reduceStop(s, currentModeRef.current));

    if (previewMode) return;

    streamClient.send({ type: 'chat/stop' }).catch(err => {
      console.error('Failed to stop task remotely:', err);
      uiActions.setError('Could not stop the assistant — it may still be working.');
    });
  }, [previewMode, commit, uiActions, currentModeRef]);

  const chatActions = useMemo<ChatActions>(
    () => ({ addMessage, updateMessage, removeMessage, setMessages, clearMessages, messageDispatch }),
    [addMessage, updateMessage, removeMessage, setMessages, clearMessages, messageDispatch],
  );

  const taskActions = useMemo<TaskActions>(() => ({ resetTask, stopTask }), [resetTask, stopTask]);

  const contextValue = useMemo<ChatContextType>(
    () => ({ messages: state.messages, chatActions, taskState: state.task, taskActions }),
    [state.messages, chatActions, state.task, taskActions],
  );

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

export const useChatContext = (): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};

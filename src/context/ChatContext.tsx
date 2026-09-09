/**
 * React context owning the widget's chat store and its live SSE wiring: one committed `{messages, task}`
 * state, the `ChatActions`/`TaskActions` mutators reached through `useChatContext` (which throws outside
 * `ChatProvider`), turn dispatch, tool execution, the stop path. Messages and task share ONE state object
 * so they cannot tear across an await.
 *
 * `commit` is the ONLY writer of the `stateRef` mirror — re-syncing from render could regress it between a
 * commit and its paint — and runs the transition synchronously, not inside a `setState` updater: React
 * defers updaters and loses the effects captured in them, so tool calls never execute. `messageDispatch`
 * short-circuits in preview mode, refuses without credentialed config, appends the user bubble and a
 * `thinking` placeholder, then POSTs fire-and-forget — the reply arrives over SSE, so only a POST failure
 * resolves it locally. A stale-reply watchdog keyed on id AND part count re-arms on every progress line.
 *
 * The stream effect subscribes to the `StreamClient` singleton: `handleMessage` does the bookkeeping the
 * pure reducer cannot hold (`tool_call_id` dedupe in a bounded set, cleared on a terminal status), then
 * each effect runs its browser tool, stamps progress, replies `tool/response` and only then fires
 * `afterResponseAttempt`. `handleError` converts only a `StreamGaveUpError` into a transport failure, as a
 * retriable blip settles when the reply lands on the reconnected stream. `stopTask` sends `chat/stop`,
 * which carries no task id, and surfaces a send failure explicitly since `do` mode may still be clicking.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { WidgetEvent } from '../sdk';
import { browserToolService, FINISH_TOOL } from '../services/BrowserToolService';
import { chatPost } from '../services/ChatService';
import { storageService } from '../services/StorageService';
import { StreamClient, StreamGaveUpError } from '../services/StreamClient';
import type { ChatMessage, InstructionType } from '../types';
import { createAgentMessage, createUserMessage } from '../utils/chat';
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

export interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  messageDispatch: (content: string, mode?: InstructionType, skipUserMessage?: boolean) => Promise<void>;
}

export interface TaskActions {
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

export const ChatProvider: React.FC<ChatProviderProps> = ({ children, previewMode = false }) => {
  const { uiState, uiActions } = useUIStateContext();
  const [state, setState] = useState<SseState>(() => ({ messages: [], task: { phase: 'idle' } }));

  const stateRef = useRef<SseState>(state);

  const currentModeRef = useRef(uiState.currentMode);
  currentModeRef.current = uiState.currentMode;

  const processedToolCallIds = useRef(new Set<string>());

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
      .map(id => setTimeout(() => commit(s => reduceStaleReply(s, id, STALE_REPLY_TEXT)), STALE_REPLY_TIMEOUT_MS));

    return () => watchdogs.forEach(clearTimeout);
  }, [pendingReplies, commit]);

  const messageDispatch = useCallback(
    async (content: string, mode?: InstructionType, skipUserMessage?: boolean) => {
      const effectiveMode = mode ?? currentModeRef.current;

      if (previewMode) {
        if (!skipUserMessage) {
          addMessage(createUserMessage(content, effectiveMode));
        }
        addMessage(createAgentMessage("This is a preview. In production, I'll respond to your messages here."));
        return;
      }

      const config = storageService.getCredentialedConfig();

      if (!config) {
        console.error('Config not loaded or incomplete');
        addMessage(
          createAgentMessage('Configuration error: Missing API credentials. Please check your widget settings.'),
        );
        return;
      }

      if (!skipUserMessage) {
        addMessage(createUserMessage(content, effectiveMode));
      }

      const placeholderId = `temp-${globalThis.crypto.randomUUID()}`;
      const placeholderMsg: ChatMessage = {
        id: placeholderId,
        content: '',
        sender: 'agent',
        timestamp: new Date(),
        mode: effectiveMode,
        isPlaceholder: true,
        placeholderState: 'thinking',
        parts: [],
      };
      commit(s => reduceDispatch(s, placeholderMsg));

      try {
        await chatPost(config, content, effectiveMode, placeholderId);
      } catch (error) {
        console.error('Failed to send message:', error);
        commit(s =>
          reduceError(s, placeholderId, "I'm sorry, I encountered an error processing your request. Please try again."),
        );
      }
    },
    [previewMode, addMessage, commit],
  );

  useEffect(() => {
    if (previewMode) return;

    const streamClient = StreamClient.getInstance();

    const startToolCall = async (effect: Extract<SseEffect, { type: 'executeTool' }>) => {
      const { toolCallId, tool, args, mode, explanation } = effect;
      const result = await browserToolService.executeTool(tool, args, mode, explanation);
      const error = result.success ? undefined : result.error;

      commit(s =>
        reduceToolProgress(s, tool, explanation, error ? 'failed' : 'completed', currentModeRef.current, error),
      );
      if (!error && tool === FINISH_TOOL) {
        commit(s => reduceToolDone(s, currentModeRef.current));
      }

      await streamClient
        .send({
          type: 'tool/response',
          tool_call_id: toolCallId,
          success: result.success,
          ...(result.success && { data: JSON.stringify(result.data) }),
          error,
        })
        .catch(err => console.error('Failed to send tool response:', err));

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
      }

      let effects: SseEffect[] = [];
      commit(state => {
        const result = reduceSse(state, event, currentModeRef.current);
        effects = result.effects;
        return result.state;
      });

      for (const effect of effects) {
        startToolCall(effect).catch(error => console.error('[Widget] Tool call failed:', error));
      }
    };

    const handleError = (error: Error) => {
      uiActions.setError(error.message);
      if (error instanceof StreamGaveUpError) commit(s => reduceTransportFailure(s, error.message));
    };

    const callbacks = { onMessage: handleMessage, onError: handleError };
    streamClient.addCallbacks(callbacks);

    return () => {
      streamClient.removeCallbacks(callbacks);
    };
  }, [previewMode, commit, uiActions]);

  const stopTask = useCallback(async () => {
    commit(s => reduceStop(s, currentModeRef.current));

    if (previewMode) return;

    StreamClient.getInstance()
      .send({ type: 'chat/stop' })
      .catch(err => {
        console.error('Failed to stop task remotely:', err);
        uiActions.setError('Could not stop the assistant — it may still be working.');
      });
  }, [previewMode, commit, uiActions]);

  const chatActions = useMemo<ChatActions>(
    () => ({ addMessage, updateMessage, removeMessage, setMessages, clearMessages, messageDispatch }),
    [addMessage, updateMessage, removeMessage, setMessages, clearMessages, messageDispatch],
  );

  const taskActions = useMemo<TaskActions>(() => ({ resetTask, stopTask }), [resetTask, stopTask]);

  return (
    <ChatContext.Provider value={{ messages: state.messages, chatActions, taskState: state.task, taskActions }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};

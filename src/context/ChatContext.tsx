/**
 * React context owning the widget's whole chat store and its live SSE wiring: one committed
 * `{messages, task}` state, the mutators the UI calls, dispatch of a visitor turn, execution of
 * agent tool calls, and the stop path. Messages and task live in ONE state object so they cannot
 * tear across an await.
 *
 * Contents: `ChatActions` / `TaskActions` / `ChatContextType` — the context surface consumed via
 * `useChatContext` (which throws outside `ChatProvider`). `ChatProvider` holds `SseState` plus a
 * `stateRef` mirror and a `currentModeRef` mirror of the composer mode. `commit` applies a
 * transition and skips a no-op write. `addMessage`, `updateMessage`, `removeMessage`,
 * `setMessages`, `clearMessages` and `resetTask` are its one-line mutators. A `pendingReplies` key
 * drives the stale-reply watchdog effect, which after `STALE_REPLY_TIMEOUT_MS` folds
 * `STALE_REPLY_TEXT` into a still-waiting placeholder. `messageDispatch` short-circuits in preview
 * mode, refuses without credentialed config, appends the user bubble plus a `thinking` placeholder
 * and POSTs — fire-and-forget: the reply arrives over SSE, so the placeholder stays `thinking` and
 * only a POST failure resolves it locally. The stream effect subscribes to the `StreamClient`
 * singleton with `handleMessage` (dedupe/reset bookkeeping, then the pure reducer, then its
 * effects) and `handleError`; each `executeTool` effect is handed to `startToolCall`, which runs the
 * browser tool, stamps progress, finishes on `FINISH_TOOL`, replies `tool/response` and then calls
 * `afterResponseAttempt`. `stopTask` stamps the message stopped and sends `chat/stop`. `chatActions`
 * / `taskActions` are the memoized bundles.
 *
 * `commit` is the ONLY writer of `stateRef` — re-syncing it from render could regress the ref
 * between a commit and its paint. It also runs the transition synchronously rather than inside a
 * `setState` updater: React defers updaters (background tab, mid-burst) and the effects captured in
 * them are lost, which showed up as tool calls that never executed.
 *
 * The watchdog key is id AND part count so the timer re-arms on every progress line — a placeholder
 * mid-run is silent, not finished, and the previous id-only key left it with no second timer.
 *
 * `handleMessage` does the transport bookkeeping (`tool_call_id` dedupe with a bounded set, cleared
 * on a terminal `task/status`) before the pure reducer, which cannot hold that state.
 *
 * `handleError` surfaces every stream error to the UI but only converts a `StreamGaveUpError` into a
 * transport failure: a retriable blip settles when the reply lands on the reconnected stream, a
 * give-up never does, and the composer stays disabled for as long as one bubble is still waiting.
 *
 * `chat/stop` carries no task id — the api stops the one dispatch it holds for this chat. When that
 * send fails the user gets an explicit error even though `reduceStop` already stamped the message
 * "stopped": in `do` mode the agent may still be clicking through the visitor's page, and `send`'s
 * own "Failed to send message" toast names the transport rather than the thing the user asked for
 * and did not get.
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

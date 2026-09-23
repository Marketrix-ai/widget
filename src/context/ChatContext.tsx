/**
 * React context owning the widget's chat store and its live wiring, reached through `useChatContext`.
 *
 * Every mutation is a `chatReducer` transition. `sendTurn` is the one way a visitor turn enters the chat,
 * typed or a chip: Show and Do first ask for screen access unless a share is live or the tenant turned it
 * off, and `allowScreenAccess`/`denyScreenAccess` release the held turn. `stopTask` cancels a running turn.
 * The stream handlers dedupe a resent `tool/call`, run the browser tool and reply with its result, and clear
 * a stale connection error once the stream recovers. The screen-share store is mirrored into the transcript
 * as it starts and ends. Preview mode answers every turn locally. The api never replays a chat_id's past
 * events on reconnect, so `chat/delta`/`chat/response` need no dedupe here.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useWidgetConfig } from '../hooks/useWidget';
import type { WidgetEvent } from '../sdk';
import { browserToolService } from '../services/BrowserToolService';
import { getOrCreateChatId } from '../services/chatSession';
import { activeScreenStream, startScreenShare, subscribeScreenShare } from '../services/ScreenShareService';
import { streamClient, StreamGaveUpError } from '../services/StreamClient';
import type { ChatMessage, InstructionType } from '../types';
import {
  CHAT_FAILURE_TEXT,
  createAgentMessage,
  createPlaceholderMessage,
  createScreenAccessRequestMessage,
  createSystemMessage,
  createUserMessage,
} from '../utils/chat';
import { logWarn } from '../utils/log';
import {
  type ChatState,
  isTerminalTaskStatus,
  openScreenAccessRequest,
  reduceAppend,
  reduceDispatch,
  reduceError,
  reduceEvent,
  reduceScreenAccessResolved,
  reduceScreenShareStarted,
  reduceScreenShareStopped,
  reduceStaleReply,
  reduceStop,
  reduceToolDone,
  reduceToolProgress,
  reduceTransportFailure,
  type TaskState,
  type ToolProgress,
  type ToolRun,
} from './chatReducer';
import { useUIStateContext } from './UIStateContext';

interface ChatActions {
  restoreMessages: (messages: ChatMessage[]) => void;
  addSystemMessage: (content: string) => void;
  clearChat: () => void;
  sendTurn: (content: string, mode: InstructionType) => Promise<boolean>;
  allowScreenAccess: () => Promise<void>;
  denyScreenAccess: () => void;
}

interface TaskActions {
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
const PREVIEW_REPLY = "This is a preview. In production, I'll respond to your messages here.";

const StaleReplyWatchdog: React.FC<{ id: string; progress: number; onStale: (id: string) => void }> = ({
  id,
  progress,
  onStale,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onStale(id), STALE_REPLY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [id, progress, onStale]);
  return null;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPreviewMode, use_screenshare } = useWidgetConfig();
  const { uiState, uiActions } = useUIStateContext();
  const [state, setState] = useState<ChatState>(() => ({ messages: [], task: { phase: 'idle' } }));

  const stateRef = useRef<ChatState>(state);
  const currentModeRef = useRef(uiState.currentMode);
  currentModeRef.current = uiState.currentMode;
  const currentErrorRef = useRef(uiState.error);
  currentErrorRef.current = uiState.error;
  const processedToolCallIds = useRef(new Set<string>());
  const lastStreamErrorRef = useRef<string | undefined>(undefined);

  const commit = useCallback((transition: (s: ChatState) => ChatState) => {
    const prev = stateRef.current;
    const next = transition(prev);
    if (next === prev || (next.messages === prev.messages && next.task === prev.task)) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const restoreMessages = useCallback((messages: ChatMessage[]) => commit(s => ({ ...s, messages })), [commit]);
  const addSystemMessage = useCallback(
    (content: string) => commit(s => reduceAppend(s, createSystemMessage(content))),
    [commit],
  );
  const clearChat = useCallback(() => commit(() => ({ messages: [], task: { phase: 'idle' } })), [commit]);
  const expireReply = useCallback((id: string) => commit(s => reduceStaleReply(s, id, STALE_REPLY_TEXT)), [commit]);

  const dispatchTurn = useCallback(
    async (content: string, mode: InstructionType): Promise<boolean> => {
      if (isPreviewMode) {
        commit(s => reduceAppend(s, createAgentMessage(PREVIEW_REPLY)));
        return true;
      }

      const placeholder = createPlaceholderMessage(mode);
      commit(s => reduceDispatch(s, placeholder));
      try {
        const chatId = await getOrCreateChatId();
        await streamClient.ready(chatId);
        await streamClient.send({ type: `chat/${mode}`, request_id: placeholder.id, content });
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        commit(s => reduceError(s, placeholder.id, CHAT_FAILURE_TEXT));
        return false;
      }
    },
    [isPreviewMode, commit],
  );

  const sendTurn = useCallback(
    async (content: string, mode: InstructionType): Promise<boolean> => {
      commit(s => reduceAppend(s, createUserMessage(content, mode)));
      const needsScreenAccess = mode !== 'tell' && use_screenshare !== false && !activeScreenStream();
      if (!needsScreenAccess) return dispatchTurn(content, mode);
      commit(s =>
        openScreenAccessRequest(s.messages) ? s : reduceAppend(s, createScreenAccessRequestMessage(mode, content)),
      );
      return true;
    },
    [use_screenshare, commit, dispatchTurn],
  );

  const resolveScreenAccess = useCallback(
    (status: 'allowed' | 'denied') => {
      const request = openScreenAccessRequest(stateRef.current.messages);
      commit(s => reduceScreenAccessResolved(s, status));
      if (request) void dispatchTurn(request.pendingContent, request.mode);
    },
    [commit, dispatchTurn],
  );

  const allowScreenAccess = useCallback(async () => {
    if (use_screenshare === false) return resolveScreenAccess('denied');
    try {
      await startScreenShare();
      resolveScreenAccess('allowed');
    } catch (error) {
      logWarn('[ChatContext] Screen share declined or unavailable:', error);
      resolveScreenAccess('denied');
    }
  }, [use_screenshare, resolveScreenAccess]);

  const denyScreenAccess = useCallback(() => resolveScreenAccess('denied'), [resolveScreenAccess]);

  useEffect(() => {
    let previous = activeScreenStream();
    return subscribeScreenShare(() => {
      const stream = activeScreenStream();
      if (stream === previous) return;
      previous = stream;
      commit(s => (stream ? reduceScreenShareStarted(s, stream) : reduceScreenShareStopped(s)));
    });
  }, [commit]);

  useEffect(() => {
    if (isPreviewMode) return;
    const setError = uiActions.setError;

    const startToolCall = async ({ call, mode }: ToolRun) => {
      const result = await browserToolService.executeTool(call.browser_tool, call.args, mode, call.explanation);
      const error = result.success ? undefined : result.error;
      const progress: ToolProgress = result.success
        ? { status: 'completed' }
        : { status: 'failed', error: result.cancelled ? undefined : result.error };

      commit(s => reduceToolProgress(s, call.browser_tool, progress, currentModeRef.current));
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

    const onMessage = (event: WidgetEvent): void => {
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

      let toolRuns: ToolRun[] = [];
      commit(s => {
        const result = reduceEvent(s, event, currentModeRef.current);
        toolRuns = result.toolRuns;
        return result.state;
      });

      for (const run of toolRuns) {
        startToolCall(run).catch((error: unknown) => {
          console.error('[Widget] Tool call failed:', error);
          setError('Something went wrong running that step. Please try again.');
        });
      }
    };

    const onError = (error: Error) => {
      setError(error.message);
      lastStreamErrorRef.current = error.message;
      if (error instanceof StreamGaveUpError) commit(s => reduceTransportFailure(s, error.message));
    };

    const callbacks = { onMessage, onError };
    streamClient.addCallbacks(callbacks);
    return () => streamClient.removeCallbacks(callbacks);
  }, [isPreviewMode, commit, uiActions, currentModeRef, currentErrorRef]);

  const stopTask = useCallback(async () => {
    commit(s => reduceStop(s, currentModeRef.current));
    if (isPreviewMode) return;
    streamClient.send({ type: 'chat/stop' }).catch(err => {
      console.error('Failed to stop task remotely:', err);
      uiActions.setError('Could not stop the assistant — it may still be working.');
    });
  }, [isPreviewMode, commit, uiActions, currentModeRef]);

  const chatActions = useMemo<ChatActions>(
    () => ({ restoreMessages, addSystemMessage, clearChat, sendTurn, allowScreenAccess, denyScreenAccess }),
    [restoreMessages, addSystemMessage, clearChat, sendTurn, allowScreenAccess, denyScreenAccess],
  );

  const taskActions = useMemo<TaskActions>(() => ({ stopTask }), [stopTask]);

  const contextValue = useMemo<ChatContextType>(
    () => ({ messages: state.messages, chatActions, taskState: state.task, taskActions }),
    [state.messages, chatActions, state.task, taskActions],
  );

  return (
    <ChatContext.Provider value={contextValue}>
      {state.messages.map(
        msg =>
          msg.kind === 'agent' &&
          msg.isPlaceholder && (
            <StaleReplyWatchdog key={msg.id} id={msg.id} progress={msg.parts.length} onStale={expireReply} />
          ),
      )}
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};

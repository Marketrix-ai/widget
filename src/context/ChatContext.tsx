/**
 * React context owning the widget's chat store and its live wiring, reached through `useChatContext`.
 * `sendTurn` is the one entry for a typed turn or chip, refusing a mode the tenant disabled or a turn while a
 * screen-access request is open, and asking for screen access first in Show and Do; `allowScreenAccess`/
 * `denyScreenAccess` release the held turn; `stopTask` cancels a running turn and its Show overlay; `clearChat`
 * stops any running turn, clears the error and starts a fresh chat thread, so the agent forgets the cleared
 * history too. The stream handlers run browser tools and reply with results; preview mode answers locally.
 * A turn the api refuses as forbidden (a mode switched off since the page loaded) shows the api's own message.
 */
import { ORPCError } from '@orpc/client';
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRequiredContext, useWidgetConfig } from '../hooks/useWidget';
import type { WidgetEvent } from '../sdk';
import { executeTool, type WidgetToolCall } from '../services/browserTools';
import { getOrCreateChatId } from '../services/chatThread';
import { activeScreenStream, startScreenShare, subscribeScreenShare } from '../services/ScreenShareService';
import { showModeService } from '../services/ShowModeService';
import { claimToolCall, forgetChatId } from '../services/StorageService';
import { GAVE_UP_TEXT, streamClient } from '../services/StreamClient';
import type { ChatMessage, InstructionType } from '../types';
import {
  CHAT_FAILURE_TEXT,
  createAgentMessage,
  createPlaceholderMessage,
  createScreenAccessRequestMessage,
  createSystemMessage,
  createUserMessage,
  enabledModes,
  isPending,
} from '../utils/chat';
import { logWarn } from '../utils/log';
import {
  type ChatState,
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
} from './chatReducer';
import { useUIStateContext } from './UIStateContext';

interface ChatActions {
  restoreMessages: (messages: ChatMessage[]) => void;
  addSystemMessage: (content: string) => void;
  clearChat: () => void;
  sendTurn: (content: string, mode: InstructionType) => Promise<boolean>;
  allowScreenAccess: () => Promise<void>;
  denyScreenAccess: () => void;
  stopTask: () => void;
}

interface ChatContextType {
  messages: ChatMessage[];
  taskState: TaskState;
  chatActions: ChatActions;
}

const ChatContext = createContext<ChatContextType | null>(null);

const STALE_REPLY_TIMEOUT_MS = 120_000;
const STALE_REPLY_TEXT = 'This is taking longer than expected. Please try again.';
const SCREEN_SHARE_FAILED_TEXT = 'Screen sharing could not start, so the assistant will continue without it.';
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
  const config = useWidgetConfig();
  const { isPreviewMode, use_screenshare } = config;
  const { uiState, uiActions } = useUIStateContext();
  const [state, setState] = useState<ChatState>(() => ({ messages: [], task: { phase: 'idle' } }));

  const stateRef = useRef<ChatState>(state);
  const currentModeRef = useRef(uiState.currentMode);
  currentModeRef.current = uiState.currentMode;

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
        const refused = error instanceof ORPCError && error.code === 'FORBIDDEN';
        if (refused) logWarn(`[ChatContext] The api refused the turn: ${error.message}`);
        else console.error('[Widget] Failed to send message:', error);
        commit(s => reduceError(s, placeholder.id, refused ? error.message : CHAT_FAILURE_TEXT));
        return false;
      }
    },
    [isPreviewMode, commit],
  );

  const sendTurn = useCallback(
    async (content: string, mode: InstructionType): Promise<boolean> => {
      if (!enabledModes(config).includes(mode) || openScreenAccessRequest(stateRef.current.messages)) return false;
      commit(s => reduceAppend(s, createUserMessage(content, mode)));
      const needsScreenAccess = mode !== 'tell' && use_screenshare !== false && !activeScreenStream();
      if (!needsScreenAccess) return dispatchTurn(content, mode);
      commit(s => reduceAppend(s, createScreenAccessRequestMessage(mode, content)));
      return true;
    },
    [config, use_screenshare, commit, dispatchTurn],
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
      commit(s => reduceAppend(s, createSystemMessage(SCREEN_SHARE_FAILED_TEXT)));
      resolveScreenAccess('denied');
    }
  }, [use_screenshare, commit, resolveScreenAccess]);

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
    const { reportFailure } = uiActions;

    const startToolCall = async (call: WidgetToolCall) => {
      const route = streamClient.route();
      const outcome = await executeTool(call.browser_tool, call.args, call.mode, call.explanation);
      if (!outcome.success && outcome.cancelled) return;
      const progress: ToolProgress = outcome.success
        ? { status: 'completed' }
        : { status: 'failed', error: outcome.error };

      commit(s => reduceToolProgress(s, call.browser_tool, progress, currentModeRef.current));
      if (outcome.success && call.browser_tool === 'done') {
        commit(s => reduceToolDone(s, currentModeRef.current, call.args));
      }

      const tool_call_id = call.tool_call_id;
      await streamClient
        .send(
          outcome.success
            ? { type: 'tool/response', tool_call_id, success: true, result: outcome.result }
            : { type: 'tool/response', tool_call_id, success: false, error: outcome.error },
          route,
        )
        .catch(reportFailure('Could not report that step back to the assistant — it may stop responding.'));

      if (outcome.success) outcome.afterResponseAttempt?.();
    };

    const onMessage = (event: WidgetEvent): void => {
      if (event.type === 'tool/call') {
        const claim = claimToolCall(event.tool_call_id);
        if (claim === 'seen') return;
        if (claim === 'interrupted') {
          streamClient
            .send({
              type: 'tool/response',
              tool_call_id: event.tool_call_id,
              success: true,
              result: { page_reloaded: true },
            })
            .catch((err: unknown) => console.error('[Widget] Failed to report an interrupted step:', err));
          return;
        }
      } else if (event.type === 'chat/error') {
        logWarn('[Widget] Chat error from server:', event.error);
      }

      const stopped = stateRef.current.task.phase === 'stopped';
      commit(s => reduceEvent(s, event, currentModeRef.current));
      if (event.type === 'tool/call' && !stopped) {
        startToolCall(event).catch(reportFailure('Something went wrong running that step. Please try again.'));
      }
    };

    const offEvent = streamClient.onEvent(onMessage);
    const offState = streamClient.subscribe(stream => {
      if (stream.phase === 'gaveUp') commit(s => reduceTransportFailure(s, GAVE_UP_TEXT[stream.reason]));
    });
    return () => {
      offEvent();
      offState();
    };
  }, [isPreviewMode, commit, uiActions, currentModeRef]);

  const stopTask = useCallback(() => {
    showModeService.cleanup();
    commit(s => reduceStop(s, currentModeRef.current));
    if (isPreviewMode) return;
    streamClient
      .send({ type: 'chat/stop' })
      .catch(uiActions.reportFailure('Could not stop the assistant — it may still be working.'));
  }, [isPreviewMode, commit, uiActions, currentModeRef]);

  const clearChat = useCallback(() => {
    const { task, messages } = stateRef.current;
    if (task.phase === 'running' || messages.some(isPending)) stopTask();
    commit(() => ({ messages: [], task: { phase: 'idle' } }));
    uiActions.setError(undefined);
    if (isPreviewMode) return;
    forgetChatId();
    getOrCreateChatId()
      .then(chatId => streamClient.connect(chatId))
      .catch(uiActions.reportFailure('Could not start a new chat. Please refresh the page.'));
  }, [isPreviewMode, commit, stopTask, uiActions]);

  const chatActions = useMemo<ChatActions>(
    () => ({ restoreMessages, addSystemMessage, clearChat, sendTurn, allowScreenAccess, denyScreenAccess, stopTask }),
    [restoreMessages, addSystemMessage, clearChat, sendTurn, allowScreenAccess, denyScreenAccess, stopTask],
  );

  const contextValue = useMemo<ChatContextType>(
    () => ({ messages: state.messages, taskState: state.task, chatActions }),
    [state.messages, state.task, chatActions],
  );

  return (
    <ChatContext.Provider value={contextValue}>
      {state.messages.filter(isPending).map(msg => (
        <StaleReplyWatchdog key={msg.id} id={msg.id} progress={msg.parts.length} onStale={expireReply} />
      ))}
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useRequiredContext(ChatContext, 'ChatProvider');

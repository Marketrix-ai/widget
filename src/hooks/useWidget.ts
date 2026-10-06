/**
 * The two context hooks every widget component reads: `useWidgetConfig` for settings, `useWidget` for the store.
 * `WidgetConfigContext` publishes the resolved config and `useWidgetConfig` reads it; `useRequiredContext` is the one
 * read of a context that throws outside its provider. `useWidget` folds `UIStateContext` and `ChatContext` into one
 * memoized `{state, actions}`, with `isComposerLocked` holding every new turn while a reply is pending or a
 * screen-access request is open, and the stream's own notice shown whenever no action failure is.
 */

import { type Context, createContext, useContext, useMemo, useSyncExternalStore } from 'react';

import { useChatContext } from '../context/ChatContext';
import { openScreenAccessRequest } from '../context/chatReducer';
import { useUIStateContext } from '../context/UIStateContext';
import { streamClient, streamNotice } from '../services/StreamClient';
import type { ValidWidgetConfig, WidgetState } from '../types';
import { isPending } from '../utils/chat';

export const WidgetConfigContext = createContext<ValidWidgetConfig | null>(null);

export const useRequiredContext = <T>(context: Context<T | null>, provider: string): T => {
  const value = useContext(context);
  if (value === null) throw new Error(`This hook must be used within ${provider}`);
  return value;
};

export const useWidgetConfig = () => useRequiredContext(WidgetConfigContext, 'WidgetProviders');

export const useWidget = () => {
  const { uiState, uiActions } = useUIStateContext();
  const { messages, taskState, chatActions } = useChatContext();
  const stream = useSyncExternalStore(streamClient.subscribe, streamClient.getState);

  const state = useMemo<WidgetState>(() => {
    const isAwaitingReply = messages.some(isPending);
    const notice = uiState.error ? undefined : streamNotice(stream);
    return {
      ...uiState,
      error: uiState.error ?? notice?.message,
      canRetry: notice?.canRetry ?? false,
      messages,
      isTaskRunning: taskState.phase === 'running',
      isAwaitingReply,
      isComposerLocked: isAwaitingReply || !!openScreenAccessRequest(messages),
    };
  }, [uiState, stream, messages, taskState]);

  const actions = useMemo(() => ({ ...uiActions, ...chatActions }), [uiActions, chatActions]);

  return { state, actions };
};

/**
 * The two context hooks every widget component reads: `useWidgetConfig` for settings, `useWidget` for the
 * store.
 * `WidgetConfigContext` publishes the resolved config and `useWidgetConfig` reads it, throwing outside a
 * provider. `useWidget` folds `UIStateContext` and `ChatContext` into one memoized `{state, actions}`, with
 * `isComposerLocked` holding every new turn while a reply is pending or a screen-access request is open.
 */

import { createContext, useContext, useMemo } from 'react';

import { useChatContext } from '../context/ChatContext';
import { openScreenAccessRequest } from '../context/chatReducer';
import { useUIStateContext } from '../context/UIStateContext';
import type { ValidWidgetConfig, WidgetState } from '../types';
import { isPending } from '../utils/chat';

export const WidgetConfigContext = createContext<ValidWidgetConfig | null>(null);

export const useWidgetConfig = (): ValidWidgetConfig => {
  const config = useContext(WidgetConfigContext);
  if (!config) throw new Error('useWidgetConfig must be used within WidgetProviders');
  return config;
};

export const useWidget = () => {
  const { uiState, uiActions } = useUIStateContext();
  const { messages, taskState, chatActions } = useChatContext();

  const state = useMemo<WidgetState>(() => {
    const isAwaitingReply = messages.some(isPending);
    return {
      ...uiState,
      messages,
      isTaskRunning: taskState.phase === 'running',
      isAwaitingReply,
      isComposerLocked: isAwaitingReply || !!openScreenAccessRequest(messages),
    };
  }, [uiState, messages, taskState]);

  const actions = useMemo(() => ({ ...uiActions, ...chatActions }), [uiActions, chatActions]);

  return { state, actions };
};

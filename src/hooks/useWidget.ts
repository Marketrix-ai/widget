/**
 * The two context hooks every widget component reads: `useWidgetConfig` for settings, `useWidget` for the
 * store.
 * `WidgetConfigContext` publishes the resolved config and `useWidgetConfig` reads it, throwing outside a
 * provider. `useWidget` folds `UIStateContext` and `ChatContext` into one memoized `{state, actions}`, and its
 * `clearChatHistory` resets messages, task and UI error together.
 */

import { createContext, useContext, useMemo } from 'react';

import { useChatContext } from '../context/ChatContext';
import { useUIStateContext } from '../context/UIStateContext';
import type { ValidWidgetConfig, WidgetState } from '../types';

export const WidgetConfigContext = createContext<ValidWidgetConfig | null>(null);

export const useWidgetConfig = (): ValidWidgetConfig => {
  const config = useContext(WidgetConfigContext);
  if (!config) throw new Error('useWidgetConfig must be used within WidgetProviders');
  return config;
};

export const useWidget = () => {
  const { uiState, uiActions } = useUIStateContext();
  const { messages, taskState, chatActions } = useChatContext();

  const state = useMemo<WidgetState>(
    () => ({
      ...uiState,
      messages,
      isTaskRunning: taskState.phase === 'running',
      isAwaitingReply: messages.some(msg => msg.kind === 'agent' && msg.isPlaceholder),
    }),
    [uiState, messages, taskState],
  );

  const actions = useMemo(
    () => ({
      ...uiActions,
      ...chatActions,
      clearChatHistory: () => {
        chatActions.clearChat();
        uiActions.setError(undefined);
      },
    }),
    [uiActions, chatActions],
  );

  return { state, actions };
};

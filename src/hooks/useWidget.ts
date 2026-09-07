import { createContext, useCallback, useContext, useMemo } from 'react';

import { useChatContext } from '../context/ChatContext';
import { useUIStateContext } from '../context/UIStateContext';
import type { MarketrixConfig, WidgetState } from '../types';
import type { WidgetRenderedSettings } from '../utils/validation';

export type ValidWidgetConfig = MarketrixConfig & Required<Pick<MarketrixConfig, keyof WidgetRenderedSettings>>;

/** Every setting resolved: API settings plus the position and script-tag overrides WidgetRoot layers on top. */
export const WidgetConfigContext = createContext<ValidWidgetConfig | null>(null);

export const useWidgetConfig = (): ValidWidgetConfig => {
  const config = useContext(WidgetConfigContext);
  if (!config) throw new Error('useWidgetConfig must be used within WidgetRoot');
  return config;
};

export const useWidget = () => {
  const { uiState, uiActions } = useUIStateContext();
  const { messages, chatActions, taskState, taskActions } = useChatContext();

  const state = useMemo<WidgetState>(
    () => ({
      ...uiState,
      messages,
      isTaskRunning: taskState.phase === 'running',
      isAwaitingReply: messages.some(msg => msg.isPlaceholder),
    }),
    [uiState, messages, taskState],
  );

  const resetChat = useCallback(() => {
    chatActions.clearMessages();
    taskActions.resetTask();
    uiActions.setError(undefined);
  }, [chatActions, taskActions, uiActions]);

  const actions = useMemo(
    () => ({ ...uiActions, ...taskActions, ...chatActions, clearChatHistory: resetChat }),
    [uiActions, taskActions, chatActions, resetChat],
  );

  return { state, actions };
};

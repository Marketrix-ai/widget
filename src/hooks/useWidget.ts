import { createContext, useCallback, useContext, useMemo } from 'react';

import { useChatContext } from '../context/ChatContext';
import { useUIStateContext } from '../context/UIStateContext';
import type { MarketrixConfig, WidgetSettingsData, WidgetState } from '../types';

export type ValidWidgetConfig = MarketrixConfig & Required<Pick<MarketrixConfig, keyof WidgetSettingsData>>;

/** Every setting resolved: API settings plus the position and script-tag overrides MarketrixWidget layers on top. */
export const WidgetConfigContext = createContext<ValidWidgetConfig | null>(null);

export const useWidgetConfig = (): ValidWidgetConfig => {
  const config = useContext(WidgetConfigContext);
  if (!config) throw new Error('useWidgetConfig must be used within MarketrixWidget');
  return config;
};

export const useWidget = () => {
  const { uiState, uiActions } = useUIStateContext();
  const { messages, chatActions, taskState, taskActions } = useChatContext();

  const state = useMemo<WidgetState>(() => ({ ...uiState, ...taskState, messages }), [uiState, messages, taskState]);

  const resetChat = useCallback(() => {
    chatActions.clearMessages();
    taskActions.setTaskState(false);
    uiActions.setError(undefined);
  }, [chatActions, taskActions, uiActions]);

  const actions = useMemo(
    () => ({ ...uiActions, ...taskActions, ...chatActions, clearChatHistory: resetChat }),
    [uiActions, taskActions, chatActions, resetChat],
  );

  return { state, actions };
};

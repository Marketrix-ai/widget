import { useCallback, useEffect, useMemo } from 'react';

import { useChatContext } from '../context/ChatContext';
import { useUIStateContext } from '../context/UIStateContext';
import { WidgetSettingsDataSchema } from '../sdk';
import { storageService } from '../services/StorageService';
import type { MarketrixConfig, WidgetSettingsData, WidgetState } from '../types';

export type ValidWidgetConfig = MarketrixConfig & Required<Pick<MarketrixConfig, keyof WidgetSettingsData>>;

interface UseWidgetProps {
  config?: MarketrixConfig;
}

function isConfigComplete(config: MarketrixConfig): config is ValidWidgetConfig {
  return WidgetSettingsDataSchema.safeParse(config).success;
}

export const useWidget = ({ config }: UseWidgetProps = {}) => {
  const { uiState, uiActions } = useUIStateContext();
  const { chatState, chatActions, taskState, taskActions } = useChatContext();

  const state = useMemo<WidgetState>(
    () => ({ ...uiState, ...taskState, messages: chatState.messages }),
    [uiState, chatState, taskState],
  );

  const resetChat = useCallback(() => {
    chatActions.clearMessages();
    taskActions.setTaskState({ activeTaskId: null, isTaskRunning: false });
    uiActions.setError(undefined);
  }, [chatActions, taskActions, uiActions]);

  const actions = useMemo(
    () => ({ ...uiActions, ...taskActions, ...chatActions, clearChatHistory: resetChat }),
    [uiActions, taskActions, chatActions, resetChat],
  );

  const marketrixConfig = useMemo<MarketrixConfig>(() => config || storageService.getConfig() || {}, [config]);
  const configValid = isConfigComplete(marketrixConfig);

  useEffect(() => {
    if (configValid) storageService.setConfig(marketrixConfig);
  }, [marketrixConfig, configValid]);

  return {
    state,
    actions,
    // Cast is safe: callers must check configValid before accessing widget setting fields.
    config: marketrixConfig as ValidWidgetConfig,
    shouldShow: configValid && marketrixConfig.widget_enabled === true,
    isPreviewMode: marketrixConfig.isPreviewMode ?? false,
    configValid,
  };
};

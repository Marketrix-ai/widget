import { useCallback, useEffect, useMemo } from 'react';

import { useChatContext } from '../context/ChatContext';
import { useUIStateContext } from '../context/UIStateContext';
import { WidgetSettingsDataSchema } from '../sdk';
import { configManager } from '../services/ConfigManager';
import type {
  ChatMessage,
  InstructionType,
  MarketrixConfig,
  WidgetSettingsData,
  WidgetState,
  WidgetView,
} from '../types';

export type ValidWidgetConfig = MarketrixConfig & Required<Pick<MarketrixConfig, keyof WidgetSettingsData>>;

interface UseWidgetProps {
  config?: MarketrixConfig;
}

function isConfigComplete(config: MarketrixConfig): config is ValidWidgetConfig {
  return WidgetSettingsDataSchema.safeParse(config).success;
}

interface UseWidgetActions {
  setActiveView: (view: WidgetView) => void;
  toggleWidget: () => void;
  closeWidget: () => void;
  setMode: (mode: InstructionType) => void;
  setLoading: (loading: boolean) => void;
  setAgentAvailable: (available: boolean) => void;
  setError: (error: string | undefined) => void;
  clearError: () => void;
  setTaskState: (payload: { activeTaskId: string | null; isTaskRunning: boolean }) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  stopTask: () => Promise<void>;
  clearChatHistory: () => void;
  messageDispatch: (
    content: string,
    mode?: InstructionType,
    applicationId?: number,
    question?: string,
    skipUserMessage?: boolean,
  ) => Promise<void>;
}

export const useWidget = ({ config }: UseWidgetProps = {}) => {
  const { uiState, uiActions } = useUIStateContext();
  const { chatState, chatActions, taskState, taskActions } = useChatContext();

  const state = useMemo<WidgetState>(
    () => ({
      isOpen: uiState.isOpen,
      isMinimized: uiState.isMinimized,
      isLoading: uiState.isLoading,
      currentMode: uiState.currentMode,
      agentAvailable: uiState.agentAvailable,
      error: uiState.error,
      activeView: uiState.activeView,
      messages: chatState.messages,
      activeTaskId: taskState.activeTaskId,
      isTaskRunning: taskState.isTaskRunning,
    }),
    [uiState, chatState, taskState],
  );

  const resetChat = useCallback(() => {
    chatActions.clearMessages();
    taskActions.setTaskState({ activeTaskId: null, isTaskRunning: false });
    uiActions.setError(undefined);
  }, [chatActions, taskActions, uiActions]);

  const actions = useMemo<UseWidgetActions>(
    () => ({
      setActiveView: uiActions.setActiveView,
      toggleWidget: uiActions.toggleWidget,
      closeWidget: uiActions.closeWidget,
      setMode: uiActions.setMode,
      setLoading: uiActions.setLoading,
      setAgentAvailable: uiActions.setAgentAvailable,
      setError: uiActions.setError,
      clearError: uiActions.clearError,
      setTaskState: taskActions.setTaskState,
      stopTask: taskActions.stopTask,
      addMessage: chatActions.addMessage,
      updateMessage: chatActions.updateMessage,
      removeMessage: chatActions.removeMessage,
      setMessages: chatActions.setMessages,
      messageDispatch: chatActions.messageDispatch,
      clearChatHistory: resetChat,
    }),
    [uiActions, taskActions, chatActions, resetChat],
  );

  const marketrixConfig = useMemo<MarketrixConfig>(() => config || configManager.getConfig() || {}, [config]);
  const configValid = isConfigComplete(marketrixConfig);

  useEffect(() => {
    if (configValid) configManager.saveConfig(marketrixConfig);
  }, [marketrixConfig, configValid]);

  const isPreviewMode = marketrixConfig.isPreviewMode ?? false;

  return {
    state,
    actions,
    // Cast is safe: callers must check configValid before accessing widget setting fields.
    config: marketrixConfig as ValidWidgetConfig,
    shouldShow: configValid && marketrixConfig.widget_enabled === true,
    isPreviewMode,
    configValid,
  };
};

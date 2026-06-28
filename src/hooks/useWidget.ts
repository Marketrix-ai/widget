import { useCallback, useEffect, useMemo } from 'react';

import { useConversationContext } from '../context/ConversationContext';
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
  const requiredKeys = Object.keys(WidgetSettingsDataSchema.shape) as Array<keyof WidgetSettingsData>;
  return requiredKeys.every(key => config[key] !== undefined);
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
  setTaskState: (payload: { activeSimulationId: string | null; isSimulationRunning: boolean }) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  stopTask: () => Promise<void>;
  clearChatHistory: () => void;
  sendMessage: (
    content: string,
    mode?: InstructionType,
    applicationId?: number,
    question?: string,
    skipUserMessage?: boolean,
  ) => Promise<void>;
}

/**
 * Composes UIStateContext and ConversationContext into the unified
 * `{ state, actions, config, … }` shape that the widget UI consumes. New code
 * can either keep using this hook or read the focused contexts directly.
 */
export const useWidget = ({ config }: UseWidgetProps = {}) => {
  const { uiState, uiActions } = useUIStateContext();
  const { chatState, chatActions, taskState, taskActions } = useConversationContext();

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
      activeSimulationId: taskState.activeSimulationId,
      isSimulationRunning: taskState.isSimulationRunning,
    }),
    [uiState, chatState, taskState],
  );

  const resetChat = useCallback(() => {
    chatActions.clearMessages();
    taskActions.setTaskState({ activeSimulationId: null, isSimulationRunning: false });
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
      sendMessage: chatActions.sendMessage,
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

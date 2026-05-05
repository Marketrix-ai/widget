import { useCallback, useEffect, useMemo } from 'react';

import { useChatContext } from '../context/ChatContext';
import { useTaskContext } from '../context/TaskContext';
import { useUIStateContext } from '../context/UIStateContext';
import { WidgetSettingsDataSchema } from '../sdk';
import { configManager } from '../services/ConfigManager';
import type {
  ChatMessage,
  InstructionType,
  MarketrixConfig,
  TaskProgress,
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
  setState: (payload: Partial<WidgetState>) => void;
  setActiveView: (view: WidgetView) => void;
  toggleWidget: () => void;
  closeWidget: () => void;
  setMode: (mode: InstructionType) => void;
  setLoading: (loading: boolean) => void;
  setAgentAvailable: (available: boolean) => void;
  setError: (error: string | undefined) => void;
  clearError: () => void;
  setTaskState: (payload: {
    activeTaskId: string | null;
    isTaskRunning: boolean;
    taskProgress?: TaskProgress[];
  }) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  resetState: () => void;
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
 * Composes UIStateContext, ChatContext, and TaskContext into the unified
 * `{ state, actions, config, … }` shape that the widget UI consumes. New code
 * can either keep using this hook or read the focused contexts directly.
 */
export const useWidget = ({ config }: UseWidgetProps = {}) => {
  const { uiState, uiActions } = useUIStateContext();
  const { chatState, chatActions } = useChatContext();
  const { taskState, taskActions } = useTaskContext();

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
      taskProgress: taskState.taskProgress,
    }),
    [uiState, chatState, taskState],
  );

  const setState = useCallback<UseWidgetActions['setState']>(
    payload => {
      uiActions.applyState({
        ...(payload.isOpen !== undefined && { isOpen: payload.isOpen }),
        ...(payload.isMinimized !== undefined && { isMinimized: payload.isMinimized }),
        ...(payload.isLoading !== undefined && { isLoading: payload.isLoading }),
        ...(payload.currentMode !== undefined && { currentMode: payload.currentMode }),
        ...(payload.agentAvailable !== undefined && { agentAvailable: payload.agentAvailable }),
        ...(payload.error !== undefined && { error: payload.error }),
        ...(payload.activeView !== undefined && { activeView: payload.activeView }),
      });
      if (payload.messages !== undefined) chatActions.setMessages(payload.messages);
      if (
        payload.activeTaskId !== undefined ||
        payload.isTaskRunning !== undefined ||
        payload.taskProgress !== undefined
      ) {
        taskActions.setTaskState({
          activeTaskId: payload.activeTaskId ?? taskState.activeTaskId,
          isTaskRunning: payload.isTaskRunning ?? taskState.isTaskRunning,
          taskProgress: payload.taskProgress ?? taskState.taskProgress,
        });
      }
    },
    [uiActions, chatActions, taskActions, taskState],
  );

  const resetChat = useCallback(() => {
    chatActions.clearMessages();
    taskActions.setTaskState({ activeTaskId: null, isTaskRunning: false, taskProgress: [] });
    uiActions.setError(undefined);
  }, [chatActions, taskActions, uiActions]);

  const actions = useMemo<UseWidgetActions>(
    () => ({
      setState,
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
      resetState: resetChat,
      clearChatHistory: resetChat,
    }),
    [setState, uiActions, taskActions, chatActions, resetChat],
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

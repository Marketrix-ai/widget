/**
 * WidgetContext — compatibility shim.
 *
 * Assembles UIStateContext, ChatContext, and TaskContext into the original
 * { state, actions } shape so all existing consumers keep working unchanged.
 *
 * New code should import from the focused contexts directly:
 *   - UIStateContext  → isOpen, isMinimized, activeView, currentMode, …
 *   - ChatContext     → messages, sendMessage, addMessage, …
 *   - TaskContext     → isTaskRunning, activeTaskId, stopTask, …
 */
import React, { createContext, useContext, useMemo } from 'react';

import type { ChatMessage, InstructionType, TaskProgress, WidgetState, WidgetView } from '../types';
import { useChatContext } from './ChatContext';
import { useTaskContext } from './TaskContext';
import { useUIStateContext } from './UIStateContext';
import { WidgetProviders } from './WidgetProviders';

// ---------------------------------------------------------------------------
// Legacy combined context type — preserved for full backwards compatibility
// ---------------------------------------------------------------------------

interface WidgetContextType {
  state: WidgetState;
  actions: {
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
  };
}

// ---------------------------------------------------------------------------
// Internal assembled context
// ---------------------------------------------------------------------------

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

/**
 * WidgetContextAssembler — must render inside WidgetProviders so all three
 * focused contexts are available. Assembles the legacy { state, actions } shape.
 */
export const WidgetContextAssembler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const actions = useMemo<WidgetContextType['actions']>(
    () => ({
      setState: (payload: Partial<WidgetState>) => {
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
      resetState: () => {
        chatActions.clearMessages();
        taskActions.setTaskState({ activeTaskId: null, isTaskRunning: false, taskProgress: [] });
        uiActions.setError(undefined);
      },
      clearChatHistory: () => {
        chatActions.clearMessages();
        taskActions.setTaskState({ activeTaskId: null, isTaskRunning: false, taskProgress: [] });
        uiActions.setError(undefined);
      },
    }),
    [uiActions, chatActions, taskActions, taskState],
  );

  return <WidgetContext.Provider value={{ state, actions }}>{children}</WidgetContext.Provider>;
};

// ---------------------------------------------------------------------------
// WidgetProvider — drop-in replacement for the old monolithic provider
// ---------------------------------------------------------------------------

interface WidgetProviderProps {
  children: React.ReactNode;
  /** Preview mode disables all network ops (SSE, API, SessionManager) */
  previewMode?: boolean;
}

export const WidgetProvider: React.FC<WidgetProviderProps> = ({ children, previewMode = false }) => (
  <WidgetProviders previewMode={previewMode}>
    <WidgetContextAssembler>{children}</WidgetContextAssembler>
  </WidgetProviders>
);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useWidgetContext = () => {
  const context = useContext(WidgetContext);
  if (context === undefined) {
    throw new Error('useWidgetContext must be used within a WidgetProvider');
  }
  return context;
};

/**
 * WidgetProviders — composition root that wires UIStateProvider and
 * ConversationProvider together.
 *
 * Conversation state ({ messages, task }) lives in ONE store (ConversationProvider);
 * UI state (open/minimized/mode/loading/error) lives in UIStateProvider. Both
 * one-time initialization (SSE connection, ChatService hydration) and persistence
 * live in inner bridge components that can read every context. React context is
 * the single source of truth; ChatService is the load/persist boundary only,
 * driven by one effect here.
 */
import React, { useEffect } from 'react';

import { chatService } from '../services/ChatService';
import { configManager } from '../services/ConfigManager';
import { sessionManager } from '../services/SessionManager';
import { StreamClient } from '../services/StreamClient';
import { ConversationProvider, useConversationContext } from './ConversationContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

// Persistence bridge — single context → storage effect (innermost, sees all state).
const PersistBridge: React.FC<{ previewMode: boolean }> = ({ previewMode }) => {
  const { uiState } = useUIStateContext();
  const { chatState, taskState } = useConversationContext();

  useEffect(() => {
    if (previewMode) return;
    chatService.persist({
      messages: chatState.messages,
      isTaskRunning: taskState.isTaskRunning,
      activeTaskId: taskState.activeTaskId,
      currentMode: uiState.currentMode,
      isOpen: uiState.isOpen,
      isMinimized: uiState.isMinimized,
      isLoading: uiState.isLoading,
    });
  }, [
    previewMode,
    chatState.messages,
    taskState.isTaskRunning,
    taskState.activeTaskId,
    uiState.currentMode,
    uiState.isOpen,
    uiState.isMinimized,
    uiState.isLoading,
  ]);

  return null;
};

// Initialization bridge — hydrates from ChatService + connects the stream, then
// seeds the conversation store. Sees both UIState and Conversation contexts.
const InitBridge: React.FC<{ children: React.ReactNode; previewMode: boolean }> = ({ children, previewMode }) => {
  const { uiActions } = useUIStateContext();
  const { chatActions, taskActions } = useConversationContext();

  // One-time initialization: hydrate from ChatService + connect stream.
  useEffect(() => {
    if (previewMode) return;

    const init = async () => {
      const chatId = await sessionManager.getOrCreateChatId();
      chatService.createInitialContext(chatId);

      const initErr = chatService.getInitError();
      if (initErr) {
        uiActions.setError('Widget failed to initialise — please refresh the page.');
      }

      chatService.initialize(chatId);

      const snapshot = chatService.restore();

      uiActions.applyState({
        isLoading: snapshot.isLoading,
        currentMode: snapshot.currentMode,
        isOpen: snapshot.isOpen,
        isMinimized: snapshot.isMinimized,
      });

      chatActions.setMessages(snapshot.messages);
      taskActions.setTaskState({
        activeTaskId: snapshot.isTaskRunning ? snapshot.activeTaskId : null,
        isTaskRunning: snapshot.isTaskRunning,
      });

      if (chatId) {
        const streamClient = StreamClient.getInstance();
        const streamConfig = configManager.getConfig();
        streamClient
          .connect(
            chatId,
            streamConfig
              ? {
                  mtxId: streamConfig.mtxId,
                  mtxKey: streamConfig.mtxKey,
                  mtxApp: streamConfig.mtxApp,
                }
              : undefined,
          )
          .catch((err: unknown) => console.error('Initial stream connection failed:', err));
      }
    };

    void init();
  }, []);

  return (
    <>
      {children}
      <PersistBridge previewMode={previewMode} />
    </>
  );
};

// UIState → Conversation bridge (reads UIState to inject into ConversationProvider).
const UIStateBridge: React.FC<{ children: React.ReactNode; previewMode: boolean }> = ({ children, previewMode }) => {
  const { uiState, uiActions } = useUIStateContext();

  return (
    <ConversationProvider previewMode={previewMode} currentMode={uiState.currentMode} uiActions={uiActions}>
      <InitBridge previewMode={previewMode}>{children}</InitBridge>
    </ConversationProvider>
  );
};

interface WidgetProvidersProps {
  children: React.ReactNode;
  previewMode?: boolean;
}

export const WidgetProviders: React.FC<WidgetProvidersProps> = ({ children, previewMode = false }) => (
  <UIStateProvider>
    <UIStateBridge previewMode={previewMode}>{children}</UIStateBridge>
  </UIStateProvider>
);

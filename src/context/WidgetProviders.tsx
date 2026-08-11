import React, { createContext, useContext, useEffect } from 'react';

import { chatService } from '../services/ChatService';
import { chatSessionManager } from '../services/ChatSessionManager';
import { configManager } from '../services/ConfigManager';
import { StreamClient } from '../services/StreamClient';
import { ChatProvider, useChatContext } from './ChatContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

const PortalContainerContext = createContext<HTMLElement | ShadowRoot | null>(null);

export const usePortalContainer = (): HTMLElement | ShadowRoot => useContext(PortalContainerContext) ?? document.body;

const PersistBridge: React.FC<{ previewMode: boolean }> = ({ previewMode }) => {
  const { uiState } = useUIStateContext();
  const { chatState, taskState } = useChatContext();

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

const InitBridge: React.FC<{ children: React.ReactNode; previewMode: boolean }> = ({ children, previewMode }) => {
  const { uiActions } = useUIStateContext();
  const { chatActions, taskActions } = useChatContext();

  useEffect(() => {
    if (previewMode) return;

    const init = async () => {
      const chatId = await chatSessionManager.getOrCreateChatId();
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

    void init().catch(error => {
      console.error('Widget initialization failed:', error);
      uiActions.setError('Widget failed to initialise — please refresh the page.');
    });
  }, []);

  return (
    <>
      {children}
      <PersistBridge previewMode={previewMode} />
    </>
  );
};

const UIStateBridge: React.FC<{ children: React.ReactNode; previewMode: boolean }> = ({ children, previewMode }) => {
  const { uiState, uiActions } = useUIStateContext();

  return (
    <ChatProvider previewMode={previewMode} currentMode={uiState.currentMode} uiActions={uiActions}>
      <InitBridge previewMode={previewMode}>{children}</InitBridge>
    </ChatProvider>
  );
};

interface WidgetProvidersProps {
  children: React.ReactNode;
  previewMode?: boolean;
  portalContainer?: HTMLElement | ShadowRoot;
}

export const WidgetProviders: React.FC<WidgetProvidersProps> = ({ children, previewMode = false, portalContainer }) => (
  <PortalContainerContext value={portalContainer ?? null}>
    <UIStateProvider>
      <UIStateBridge previewMode={previewMode}>{children}</UIStateBridge>
    </UIStateProvider>
  </PortalContainerContext>
);

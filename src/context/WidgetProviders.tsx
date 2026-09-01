import React, { createContext, useContext, useEffect } from 'react';

import { chatService } from '../services/ChatService';
import { chatSessionManager } from '../services/ChatSessionManager';
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
    const { currentMode, isOpen, isLoading } = uiState;
    chatService.persist({ messages: chatState.messages, ...taskState, currentMode, isOpen, isLoading });
  }, [previewMode, chatState, taskState, uiState]);

  return null;
};

const InitBridge: React.FC<{ children: React.ReactNode; previewMode: boolean }> = ({ children, previewMode }) => {
  const { uiActions } = useUIStateContext();
  const { chatActions, taskActions } = useChatContext();

  useEffect(() => {
    if (previewMode) return;
    let cancelled = false;

    const init = async () => {
      const chatId = await chatSessionManager.getOrCreateChatId();
      if (cancelled) return;

      const { messages, isTaskRunning, activeTaskId, ...ui } = chatService.restore();
      uiActions.applyState(ui);
      chatActions.setMessages(messages);
      taskActions.setTaskState({ activeTaskId: isTaskRunning ? activeTaskId : null, isTaskRunning });

      StreamClient.getInstance()
        .connect(chatId)
        .catch((err: unknown) => console.error('Initial stream connection failed:', err));
    };

    void init().catch(error => {
      if (cancelled) return;
      console.error('Widget initialization failed:', error);
      uiActions.setError('Widget failed to initialise — please refresh the page.');
    });

    return () => {
      cancelled = true;
    };
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

import React, { createContext, useContext, useEffect } from 'react';

import { chatService } from '../services/ChatService';
import { chatSessionManager } from '../services/ChatSessionManager';
import { StreamClient } from '../services/StreamClient';
import { ChatProvider, useChatContext } from './ChatContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

/** MarketrixWidget publishes its own root here: a portal outside it escapes the element carrying the tenant tokens. */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = (): HTMLElement => useContext(PortalContainerContext) ?? document.body;

/** Its own component so the subscription to every message change cannot re-render the tree InitBridge wraps. */
const PersistBridge: React.FC<{ previewMode: boolean }> = ({ previewMode }) => {
  const { uiState } = useUIStateContext();
  const { messages, taskState } = useChatContext();

  useEffect(() => {
    if (previewMode) return;
    const { currentMode, isOpen } = uiState;
    chatService.persist({ messages, ...taskState, currentMode, isOpen });
  }, [previewMode, messages, taskState, uiState]);

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

      const { messages, isTaskRunning, ...ui } = chatService.restore();
      uiActions.applyState(ui);
      chatActions.setMessages(messages);
      taskActions.setTaskState(isTaskRunning);

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

interface WidgetProvidersProps {
  children: React.ReactNode;
  previewMode?: boolean;
}

export const WidgetProviders: React.FC<WidgetProvidersProps> = ({ children, previewMode = false }) => (
  <UIStateProvider>
    <ChatProvider previewMode={previewMode}>
      <InitBridge previewMode={previewMode}>{children}</InitBridge>
    </ChatProvider>
  </UIStateProvider>
);

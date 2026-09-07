import React, { createContext, useContext, useEffect, useState } from 'react';

import { chatService } from '../services/ChatService';
import { chatSessionManager } from '../services/ChatSessionManager';
import { StreamClient } from '../services/StreamClient';
import { ChatProvider, useChatContext } from './ChatContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

/** WidgetRoot publishes its own root here: a portal outside it escapes the element carrying the tenant tokens. */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = (): HTMLElement => useContext(PortalContainerContext) ?? document.body;

/** Its own component so the subscription to every message change cannot re-render the tree InitBridge wraps. */
const PersistBridge: React.FC = () => {
  const { uiState } = useUIStateContext();
  const { messages } = useChatContext();

  useEffect(() => {
    const { currentMode, isOpen } = uiState;
    chatService.persist({ messages, currentMode, isOpen });
  }, [messages, uiState]);

  return null;
};

const InitBridge: React.FC<{ children: React.ReactNode; previewMode: boolean }> = ({ children, previewMode }) => {
  const { uiActions } = useUIStateContext();
  const { chatActions } = useChatContext();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (previewMode) return;
    let cancelled = false;

    const init = async () => {
      const chatId = await chatSessionManager.getOrCreateChatId();
      if (cancelled) return;

      const { messages, ...ui } = chatService.restore();
      uiActions.applyState(ui);
      chatActions.setMessages(messages);
      setRestored(true);

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
      {restored && <PersistBridge />}
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

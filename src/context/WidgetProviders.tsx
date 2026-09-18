/**
 * The widget's provider stack and the two bridges under it. `WidgetProviders` wraps children in
 * `UIStateProvider` → `ChatProvider` → `InitBridge`. Also home to `PortalContainerContext` /
 * `usePortalContainer`, which `WidgetRoot` uses to publish its own root so a portal lands somewhere
 * carrying the tenant's theme tokens rather than falling back to `document.body`.
 *
 * `InitBridge` runs the one-shot mount init: restore the stored snapshot into UI state and the chat
 * store, then get-or-create the chat id and open the stream. Task state is deliberately not restored,
 * since a run never survives a reload. `PersistBridge` writes the snapshot back on every change, kept
 * as its own component so it doesn't re-render the tree `InitBridge` wraps. `previewMode` skips all of
 * this — no chat session, no stream, nothing persisted.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

import { chatSessionManager } from '../services/ChatSessionManager';
import { readChatSnapshot, writeChatSnapshot } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import { ChatProvider, useChatContext } from './ChatContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = (): HTMLElement => useContext(PortalContainerContext) ?? document.body;

const PersistBridge: React.FC = () => {
  const { uiState } = useUIStateContext();
  const { messages } = useChatContext();

  useEffect(() => {
    const { currentMode, isOpen } = uiState;
    writeChatSnapshot({ messages, currentMode, isOpen });
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
      const { messages, ...ui } = readChatSnapshot();
      uiActions.applyState(ui);
      chatActions.setMessages(messages);
      setRestored(true);

      const chatId = await chatSessionManager.getOrCreateChatId();
      if (cancelled) return;

      void streamClient.connect(chatId);
    };

    void init().catch(error => {
      if (cancelled) return;
      console.error('Widget initialization failed:', error);
      uiActions.setError('Widget failed to initialise — please refresh the page.');
    });

    return () => {
      cancelled = true;
    };
  }, [previewMode, uiActions, chatActions]);

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

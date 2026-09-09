/**
 * The widget's provider stack and the two bridges under it: `WidgetProviders` wraps children in
 * `UIStateProvider` → `ChatProvider` → `InitBridge`, so everything below reads UI state and the chat
 * store from context. Also the home of `PortalContainerContext` and `usePortalContainer` — `WidgetRoot`
 * publishes its own root element here, because a portal landing outside that element escapes the one
 * carrying the tenant tokens and falls back to `index.css`'s hardcoded palette; the default is
 * `document.body`.
 *
 * `InitBridge` runs the one-shot mount init: read the stored snapshot, apply `{currentMode, isOpen}` to
 * UI state and the transcript to the chat store, then get-or-create the chat_id and open the stream.
 * Task state is deliberately not restored — a run never survives a reload. `PersistBridge` writes the
 * snapshot back on every message or UI-state change; it is its own component so that subscription to
 * every message change cannot re-render the tree `InitBridge` wraps, and it mounts only once `restored`
 * is true — mounted before the read, its first effect would write an empty transcript over the stored
 * one on every remount.
 *
 * `previewMode` (the dashboard preview) skips init entirely: no chat session is minted and no stream is
 * opened, and since `restored` stays false nothing is persisted either.
 *
 * The init effect's deps are empty on purpose — once per mount — and `cancelled` drops the connect when
 * a StrictMode double-invoke or an unmount cleans up before the chat_id resolves. A failed connect is
 * logged only, since `StreamClient` owns the backoff reconnect; a failed init is logged AND surfaced
 * through `uiActions.setError`.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

import { chatSessionManager } from '../services/ChatSessionManager';
import { readChatSnapshot, writeChatSnapshot } from '../services/StorageService';
import { StreamClient } from '../services/StreamClient';
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

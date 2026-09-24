/**
 * The widget's provider stack: `WidgetProviders` publishes the mounted config through `WidgetConfigContext`
 * and wraps children in `UIStateProvider` → `ChatProvider` → `InitBridge`. Also home to
 * `PortalContainerContext`/`usePortalContainer`, so a portal lands inside the tenant's theme tokens.
 *
 * `InitBridge` restores the stored snapshot into UI state and the chat store, then gets or creates the chat
 * id and opens the stream. Task state is deliberately not restored, since a run never survives a reload.
 * `PersistBridge` writes the snapshot back on every change, kept as its own component so it doesn't
 * re-render the tree `InitBridge` wraps. Preview mode skips all of this.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

import { useWidgetConfig, WidgetConfigContext } from '../hooks/useWidget';
import { getOrCreateChatId } from '../services/chatThread';
import { readChatSnapshot, writeChatSnapshot } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import type { ValidWidgetConfig } from '../types';
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

const InitBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPreviewMode } = useWidgetConfig();
  const { uiActions } = useUIStateContext();
  const { chatActions } = useChatContext();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;

    const init = async () => {
      const { messages, ...ui } = readChatSnapshot();
      uiActions.applyState(ui);
      chatActions.restoreMessages(messages);
      setRestored(true);

      const chatId = await getOrCreateChatId();
      if (cancelled) return;

      await streamClient.connect(chatId);
    };

    void init().catch(error => {
      if (cancelled) return;
      console.error('[Widget] Initialization failed:', error);
      uiActions.setError('Widget failed to initialize. Please refresh the page.');
    });

    return () => {
      cancelled = true;
    };
  }, [isPreviewMode, uiActions, chatActions]);

  return (
    <>
      {children}
      {restored && <PersistBridge />}
    </>
  );
};

export const WidgetProviders: React.FC<{ config: ValidWidgetConfig; children: React.ReactNode }> = ({
  config,
  children,
}) => (
  <WidgetConfigContext value={config}>
    <UIStateProvider>
      <ChatProvider>
        <InitBridge>{children}</InitBridge>
      </ChatProvider>
    </UIStateProvider>
  </WidgetConfigContext>
);

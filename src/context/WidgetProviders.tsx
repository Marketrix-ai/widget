/**
 * The widget's provider stack: `WidgetProviders` publishes the config and wraps `UIStateProvider` →
 * `ChatProvider` → `InitBridge`, and `PortalContainerContext` lands portals inside the tenant tokens.
 * `InitBridge` restores the stored snapshot and opens the stream, `PersistBridge` writes it back; task state is
 * never restored, since a run never survives a reload. Preview mode skips both.
 */
import React, { createContext, useEffect, useState } from 'react';

import { useWidgetConfig, WidgetConfigContext } from '../hooks/useWidget';
import { getOrCreateChatId } from '../services/chatThread';
import { readChatSnapshot, writeChatSnapshot } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import type { ValidWidgetConfig } from '../types';
import { ChatProvider, useChatContext } from './ChatContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

export const PortalContainerContext = createContext<HTMLElement | null>(null);

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

    void init().catch((error: unknown) => {
      if (!cancelled) uiActions.reportFailure('Widget failed to initialize. Please refresh the page.')(error);
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

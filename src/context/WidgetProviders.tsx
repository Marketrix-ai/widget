/**
 * The widget's provider stack: `WidgetProviders` publishes the config and wraps `UIStateProvider` →
 * `ChatProvider` (on the injected transport) → `InitBridge`, and `PortalContainerContext` lands portals inside the
 * tenant tokens. `InitBridge` restores the transport's snapshot and opens it, `PersistBridge` writes it back; task
 * state is never restored, since a run never survives a reload.
 */
import React, { createContext, useEffect, useState } from 'react';

import { WidgetConfigContext } from '../hooks/useWidget';
import type { ChatTransport } from '../services/chatTransport';
import type { ValidWidgetConfig } from '../types';
import { ChatProvider, useChatContext } from './ChatContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

export const PortalContainerContext = createContext<HTMLElement | null>(null);

const PersistBridge: React.FC = () => {
  const { uiState } = useUIStateContext();
  const { messages, transport } = useChatContext();

  useEffect(() => {
    const { currentMode, isOpen } = uiState;
    transport.persist({ messages, currentMode, isOpen });
  }, [messages, uiState, transport]);

  return null;
};

const InitBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { uiActions } = useUIStateContext();
  const { chatActions, transport } = useChatContext();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const opening = new AbortController();
    const { messages, ...ui } = transport.restore();
    uiActions.applyState(ui);
    chatActions.restoreMessages(messages);
    setRestored(true);

    transport.open(opening.signal).catch((error: unknown) => {
      if (!opening.signal.aborted)
        uiActions.reportFailure('Widget failed to initialize. Please refresh the page.')(error);
    });

    return () => opening.abort();
  }, [transport, uiActions, chatActions]);

  return (
    <>
      {children}
      {restored && <PersistBridge />}
    </>
  );
};

export const WidgetProviders: React.FC<{
  config: ValidWidgetConfig;
  transport: ChatTransport;
  children: React.ReactNode;
}> = ({ config, transport, children }) => (
  <WidgetConfigContext value={config}>
    <UIStateProvider>
      <ChatProvider transport={transport}>
        <InitBridge>{children}</InitBridge>
      </ChatProvider>
    </UIStateProvider>
  </WidgetConfigContext>
);

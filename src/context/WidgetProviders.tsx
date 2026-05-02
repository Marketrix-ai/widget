/**
 * WidgetProviders — composition root that wires UIStateProvider, ChatProvider,
 * and TaskProvider together.
 *
 * Initialization logic (SSE connection, ChatService hydration) lives in the
 * inner bridge component which has access to all three contexts.
 */
import React, { useEffect, useRef } from 'react';

import { chatService } from '../services/ChatService';
import { configManager } from '../services/ConfigManager';
import { sessionManager } from '../services/SessionManager';
import { StreamClient } from '../services/StreamClient';
import { ChatProvider, useChatContextInternal } from './ChatContext';
import { TaskProvider } from './TaskContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

// ---------------------------------------------------------------------------
// Inner bridge — has access to UIState and Chat, mounts TaskProvider
// ---------------------------------------------------------------------------

interface BridgeProps {
  children: React.ReactNode;
  previewMode: boolean;
}

const WidgetContextBridge: React.FC<BridgeProps> = ({ children, previewMode }) => {
  const { uiState, uiActions } = useUIStateContext();
  const { _setMessages } = useChatContextInternal();

  // Stable ref so TaskProvider's stopTask never stale-closes over activeTaskId
  const activeTaskIdRef = useRef<string | null>(null);

  // -------------------------------------------------------------------------
  // One-time initialization: hydrate from ChatService + connect stream
  // -------------------------------------------------------------------------
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

      const isTaskRunning = chatService.getIsTaskRunning();
      const activeTaskId = chatService.getActiveTaskId();

      // Hydrate UIState from persisted ChatService values
      uiActions.applyState({
        isLoading: chatService.getIsLoading(),
        currentMode: chatService.getCurrentMode(),
        isOpen: chatService.getIsOpen(),
        isMinimized: chatService.getIsMinimized(),
      });

      // Hydrate ChatState
      _setMessages({ messages: chatService.getMessages() });

      // Hydrate activeTaskId ref
      activeTaskIdRef.current = isTaskRunning ? activeTaskId : null;

      // Connect SSE stream
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
                  mtxAgent: streamConfig.mtxAgent,
                  mtxApp: streamConfig.mtxApp,
                }
              : undefined,
          )
          .catch((err: unknown) => console.error('Initial stream connection failed:', err));
      }
    };

    void init();
    // Run once on mount
  }, []);

  return (
    <TaskProvider
      previewMode={previewMode}
      currentMode={uiState.currentMode}
      setMessages={_setMessages}
      uiActions={uiActions}
      activeTaskIdRef={activeTaskIdRef}
    >
      {children}
    </TaskProvider>
  );
};

// ---------------------------------------------------------------------------
// UIState → Chat bridge (reads UIState to inject into ChatProvider)
// ---------------------------------------------------------------------------

const UIStateBridge: React.FC<BridgeProps> = ({ children, previewMode }) => {
  const { uiState, uiActions } = useUIStateContext();

  return (
    <ChatProvider previewMode={previewMode} uiActions={uiActions} currentMode={uiState.currentMode}>
      <WidgetContextBridge previewMode={previewMode}>{children}</WidgetContextBridge>
    </ChatProvider>
  );
};

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface WidgetProvidersProps {
  children: React.ReactNode;
  previewMode?: boolean;
}

export const WidgetProviders: React.FC<WidgetProvidersProps> = ({ children, previewMode = false }) => (
  <UIStateProvider>
    <UIStateBridge previewMode={previewMode}>{children}</UIStateBridge>
  </UIStateProvider>
);

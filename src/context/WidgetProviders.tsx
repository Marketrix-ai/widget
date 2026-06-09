/**
 * WidgetProviders — composition root that wires UIStateProvider, ChatProvider,
 * and TaskProvider together.
 *
 * Initialization (SSE connection, ChatService hydration) and persistence both
 * live in inner bridge components that have access to all three contexts.
 * React context is the single source of truth; ChatService is the load/persist
 * boundary only, driven by one effect here.
 */
import React, { useEffect, useRef } from 'react';

import { chatService } from '../services/ChatService';
import { configManager } from '../services/ConfigManager';
import { sessionManager } from '../services/SessionManager';
import { StreamClient } from '../services/StreamClient';
import type { ChatMessage } from '../types';
import { ChatProvider, useChatContext, useChatContextInternal } from './ChatContext';
import { TaskProvider, useTaskContext } from './TaskContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';

// Persistence bridge — single context → storage effect (innermost, sees all state).
const PersistBridge: React.FC<{ previewMode: boolean }> = ({ previewMode }) => {
  const { uiState } = useUIStateContext();
  const { chatState } = useChatContext();
  const { taskState } = useTaskContext();

  useEffect(() => {
    if (previewMode) return;
    chatService.persist({
      messages: chatState.messages,
      isTaskRunning: taskState.isTaskRunning,
      activeTaskId: taskState.activeTaskId,
      taskProgress: taskState.taskProgress,
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
    taskState.taskProgress,
    uiState.currentMode,
    uiState.isOpen,
    uiState.isMinimized,
    uiState.isLoading,
  ]);

  return null;
};

// Inner bridge — has access to UIState and Chat, mounts TaskProvider.
interface BridgeProps {
  children: React.ReactNode;
  previewMode: boolean;
}

const TaskBridge: React.FC<BridgeProps> = ({ children, previewMode }) => {
  const { uiState, uiActions } = useUIStateContext();
  const { _setMessages } = useChatContextInternal();

  // Stable ref so TaskProvider's stopTask never stale-closes over activeTaskId
  const activeTaskIdRef = useRef<string | null>(null);
  // Live messages snapshot the SSE reducer wiring reads without stale closures
  const messagesRef = useRef<ChatMessage[]>([]);

  // One-time initialization: hydrate from ChatService + connect stream.
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

      const snapshot = chatService.restore();

      uiActions.applyState({
        isLoading: snapshot.isLoading,
        currentMode: snapshot.currentMode,
        isOpen: snapshot.isOpen,
        isMinimized: snapshot.isMinimized,
      });

      messagesRef.current = snapshot.messages;
      _setMessages({ messages: snapshot.messages });

      activeTaskIdRef.current = snapshot.isTaskRunning ? snapshot.activeTaskId : null;

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

    void init();
  }, []);

  return (
    <TaskProvider
      previewMode={previewMode}
      currentMode={uiState.currentMode}
      setMessages={_setMessages}
      messagesRef={messagesRef}
      uiActions={uiActions}
      activeTaskIdRef={activeTaskIdRef}
    >
      {children}
      <PersistBridge previewMode={previewMode} />
    </TaskProvider>
  );
};

// UIState → Chat bridge (reads UIState to inject into ChatProvider).
const UIStateBridge: React.FC<BridgeProps> = ({ children, previewMode }) => {
  const { uiState, uiActions } = useUIStateContext();

  return (
    <ChatProvider previewMode={previewMode} uiActions={uiActions} currentMode={uiState.currentMode}>
      <TaskBridge previewMode={previewMode}>{children}</TaskBridge>
    </ChatProvider>
  );
};

interface WidgetProvidersProps {
  children: React.ReactNode;
  previewMode?: boolean;
}

export const WidgetProviders: React.FC<WidgetProvidersProps> = ({ children, previewMode = false }) => (
  <UIStateProvider>
    <UIStateBridge previewMode={previewMode}>{children}</UIStateBridge>
  </UIStateProvider>
);

/**
 * Chat Initialization Hook
 *
 * Consolidates early restoration and regular initialization logic.
 * Handles chat ID creation, WebSocket setup, and context restoration.
 */

import { useCallback, useEffect, useRef } from 'react';

import MarketrixApiService from '../services/marketrixApiService';
import { restoreState } from '../services/stateRestorationService';
import {
  createErrorHandler,
  createMessageHandler,
  createStatusChangeHandler,
  createToolCallProgressCallback,
} from '../services/websocketMessageHandlers';
import { WebSocketService } from '../services/websocketService';
import { widgetStateManager } from '../services/widgetStateManager';
import type { ChatMessage, MarketrixConfig, WidgetState } from '../types';
import { getPendingToolCall } from '../utils/chatStorage';
import { initializationState } from '../utils/initializationState';
import { createLogger } from '../utils/logger';

const log = createLogger('ChatInitialization');

interface UseChatInitializationProps {
  config: MarketrixConfig;
  setState: React.Dispatch<React.SetStateAction<WidgetState>>;
  isRestoring: React.MutableRefObject<boolean>;
  activeMessageRef: React.MutableRefObject<ChatMessage | null>;
}

/**
 * Hook for managing chat initialization
 */
export function useChatInitialization({
  config,
  setState,
  isRestoring,
  activeMessageRef,
}: UseChatInitializationProps) {
  // Service references
  const apiServiceRef = useRef<MarketrixApiService | null>(null);
  const websocketServiceRef = useRef<WebSocketService | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const initializationAttemptedRef = useRef<boolean>(false);

  // Sync chatId with state manager
  useEffect(() => {
    widgetStateManager.setChatId(chatIdRef.current);
  }, [chatIdRef.current]);

  /**
   * Restore chat context from storage
   */
  const restoreChatContext = useCallback(
    (chatId: string): void => {
      // Set flag to prevent saves during restoration
      isRestoring.current = true;

      setState((prev) => {
        const restoredState = restoreState(chatId, prev);

        if (!restoredState) {
          // No restoration needed
          isRestoring.current = false;
          return prev;
        }

        const restored = {
          ...prev,
          messages: restoredState.messages,
          isTaskRunning: restoredState.isTaskRunning,
          activeTaskId: restoredState.activeTaskId,
          taskProgress: restoredState.taskProgress,
          currentMode: restoredState.currentMode,
          isOpen: restoredState.isOpen ?? prev.isOpen,
          isMinimized: restoredState.isMinimized ?? prev.isMinimized,
        };

        // Clear restoration flag after state update
        setTimeout(() => {
          isRestoring.current = false;
        }, 100);

        return restored;
      });
    },
    [setState, isRestoring]
  );

  /**
   * Setup WebSocket connection with callbacks
   */
  const setupWebSocketConnection = useCallback(
    (_chatId: string): void => {
      // Helper function to retry pending tool call if needed
      const retryPendingToolCallIfNeeded = (
        chatId: string | null,
        websocketService: WebSocketService | null
      ): void => {
        if (!chatId || !websocketService?.isConnected()) {
          return;
        }

        const pendingToolCall = getPendingToolCall(chatId);
        if (!pendingToolCall) {
          return;
        }

        log.debug('Found pending tool call, retrying after refresh:', {
          toolName: pendingToolCall.toolName,
          requestId: pendingToolCall.requestId,
          mode: pendingToolCall.mode,
        });

        websocketService
          .retryToolCall(
            pendingToolCall.requestId,
            pendingToolCall.toolName,
            pendingToolCall.arguments,
            pendingToolCall.mode,
            pendingToolCall.explanation
          )
          .catch((retryError: unknown) => {
            log.error('Failed to retry pending tool call:', retryError);
          });
      };

      // Create WebSocket callbacks
      const websocketCallbacks = {
        onStatusChange: createStatusChangeHandler(
          setState,
          retryPendingToolCallIfNeeded as (
            chatId: string | null,
            websocketService: unknown
          ) => void,
          chatIdRef,
          websocketServiceRef
        ),
        onToolCallProgress: createToolCallProgressCallback(),
        onMessage: createMessageHandler(setState, activeMessageRef),
        onError: createErrorHandler(setState),
      };

      // Initialize or update WebSocket service
      if (!websocketServiceRef.current) {
        websocketServiceRef.current = WebSocketService.getInstance(config, websocketCallbacks);
      } else {
        websocketServiceRef.current.setCallbacks(websocketCallbacks);
      }
    },
    [config, setState, activeMessageRef]
  );

  /**
   * Connect WebSocket with chat ID, handling reconnection if needed
   */
  const connectWebSocket = useCallback(async (chatId: string): Promise<void> => {
    if (!websocketServiceRef.current) {
      return;
    }

    const currentChatId = websocketServiceRef.current.getChatId();

    // Skip if already connected with same chat_id
    if (currentChatId === chatId && websocketServiceRef.current.isConnected()) {
      log.debug('WebSocket already connected with this chat_id, skipping');
      initializationState.setChatId(chatId);
      return;
    }

    // Reconnect if chat_id changed
    if (currentChatId && currentChatId !== chatId) {
      log.debug('Chat ID changed, reconnecting websocket...');
      websocketServiceRef.current.disconnect();
    }

    // Connect if not already connected
    if (!websocketServiceRef.current.isConnected()) {
      try {
        await websocketServiceRef.current.connect(chatId);
        initializationState.setChatId(chatId);
        chatIdRef.current = chatId;
        widgetStateManager.setChatId(chatId);
        log.info('WebSocket connection initiated');
      } catch (wsError) {
        log.error('Failed to connect websocket:', wsError);
      }
    } else {
      initializationState.setChatId(chatId);
      chatIdRef.current = chatId;
    }
  }, []);

  /**
   * Initialize chat session and WebSocket connection
   */
  const initializeChatSession = useCallback(async (): Promise<void> => {
    if (!apiServiceRef.current) {
      initializationState.markComplete();
      return;
    }

    // Prevent multiple simultaneous initializations
    if (!initializationState.markInProgress()) {
      log.debug('Initialization already in progress, skipping initializeChatSession');
      return;
    }

    // Check if already initialized with a chat ID
    if (initializationState.getComplete() && initializationState.getChatId()) {
      log.debug('Already initialized, skipping initializeChatSession');
      return;
    }

    try {
      // Get or create chat ID using centralized manager (prevents concurrent creation)
      const chatId = await apiServiceRef.current.getOrCreateChatId();

      // Check if we already have this chat ID initialized
      if (initializationState.getChatId() === chatId && initializationState.getComplete()) {
        log.debug('Chat ID already initialized, skipping');
        initializationState.markComplete();
        return;
      }

      log.info('Chat ID initialized:', chatId);
      initializationState.setChatId(chatId);
      chatIdRef.current = chatId;

      // Only restore context if we haven't already (early restoration may have done this)
      if (!initializationState.getEarlyRestorationDone()) {
        restoreChatContext(chatId);
      } else {
        log.debug('Early restoration already done, skipping restoreChatContext');
      }

      // Skip if already connected with this chat_id
      if (
        websocketServiceRef.current &&
        websocketServiceRef.current.getChatId() === chatId &&
        websocketServiceRef.current.isConnected()
      ) {
        log.debug('WebSocket already connected with this chat_id, skipping');
        initializationState.markComplete();
        return;
      }

      // Setup WebSocket connection
      setupWebSocketConnection(chatId);

      // Connect WebSocket
      await connectWebSocket(chatId);
    } catch (error) {
      log.error('Failed to initialize chat_id:', error);
    } finally {
      initializationState.markComplete();
    }
  }, [restoreChatContext, setupWebSocketConnection, connectWebSocket]);

  /**
   * Check if initialization should be skipped (silent version)
   */
  const shouldSkipInitializationSilent = useCallback((): boolean => {
    return initializationState.shouldSkipInitializationSilent(
      () => websocketServiceRef.current?.getChatId() ?? null,
      () => websocketServiceRef.current?.isConnected() ?? false
    );
  }, []);

  // Early restoration effect (runs once on mount)
  useEffect(() => {
    // Prevent early restoration from running multiple times
    if (initializationState.getEarlyRestorationDone()) {
      return;
    }
    // Set flag immediately to prevent concurrent executions
    initializationState.markEarlyRestorationDone();

    // Try to restore FULL context (including messages) early, before chat ID initialization
    // This ensures the widget appears in the correct state immediately on page load
    const restoredState = restoreState();
    if (restoredState) {
      // Set flag to prevent saves during restoration
      isRestoring.current = true;

      // Restore full state immediately (synchronously) if available
      setState((prev) => {
        const restored = {
          ...prev,
          messages: restoredState.messages,
          isTaskRunning: restoredState.isTaskRunning,
          activeTaskId: restoredState.activeTaskId,
          taskProgress: restoredState.taskProgress,
          currentMode: restoredState.currentMode,
          isOpen: restoredState.isOpen ?? prev.isOpen,
          isMinimized: restoredState.isMinimized ?? prev.isMinimized,
        };

        return restored;
      });

      // Clear restoration flag after a short delay to allow state to settle
      setTimeout(() => {
        isRestoring.current = false;
      }, 100);
    }
  }, [setState, isRestoring]);

  // Initialization effect
  useEffect(() => {
    // Early return: if initialization has already been attempted, don't run again
    // This prevents React.StrictMode double-invocation from causing duplicate attempts
    if (initializationAttemptedRef.current) {
      return;
    }

    // Handle reconnection if already initialized
    if (initializationState.getComplete()) {
      if (
        websocketServiceRef.current &&
        initializationState.getChatId() &&
        !websocketServiceRef.current.isConnected() &&
        !initializationState.getInProgress()
      ) {
        const chatId = initializationState.getChatId();
        log.debug('WebSocket disconnected, attempting to reconnect...');
        if (initializationState.markInProgress() && chatId) {
          websocketServiceRef.current
            .connect(chatId)
            .finally(() => {
              initializationState.markComplete();
            })
            .catch((error) => {
              log.error('Reconnection failed:', error);
            });
        }
      }
      return;
    }

    // Skip initialization if conditions are met (silent check to avoid logging)
    if (shouldSkipInitializationSilent()) {
      return;
    }

    // Mark that we've attempted initialization (prevents duplicate runs)
    initializationAttemptedRef.current = true;

    // Initialize or update API service
    if (!apiServiceRef.current) {
      apiServiceRef.current = new MarketrixApiService(config);
    } else {
      apiServiceRef.current.updateConfig(config);
    }

    // Initialize chat session and WebSocket connection
    initializeChatSession();

    // Check agent availability on mount (doesn't create chat ID)
    const checkAgentAvailability = async () => {
      if (!apiServiceRef.current) return;

      try {
        const available = await apiServiceRef.current.checkAgentAvailability();
        setState((prev) => ({ ...prev, agentAvailable: available }));
      } catch (error) {
        log.error('Failed to check agent availability:', error);
        setState((prev) => ({ ...prev, agentAvailable: false }));
      }
    };

    checkAgentAvailability();
  }, [config, initializeChatSession, shouldSkipInitializationSilent, setState]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (websocketServiceRef.current) {
        log.debug('Cleaning up websocket connection on unmount');
        websocketServiceRef.current.disconnect();
        websocketServiceRef.current = null;
      }
    };
  }, []);

  return {
    apiServiceRef,
    websocketServiceRef,
    chatIdRef,
  };
}

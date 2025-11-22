import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_MARKETRIX_CONFIG,
  DEFAULT_WIDGET_SETTINGS,
  extractWidgetSettingsFromConfig,
} from '../constants/config';
import type { InstructionType, WidgetSettingsData } from '../sdk';
import MarketrixApiService from '../services/marketrixApiService';
import { isScreenSharing, stopScreenShare } from '../services/screenShareService';
import { cleanup } from '../services/showModeService';
import {
  createErrorHandler,
  createMessageHandler,
  createStatusChangeHandler,
  createToolCallProgressCallback,
} from '../services/websocketMessageHandlers';
import { WebSocketService } from '../services/websocketService';
import type { ChatMessage, MarketrixConfig, WidgetState } from '../types';
import {
  clearChatContext,
  clearPendingToolCall,
  getPendingToolCall,
  getStoredChatContext,
  restoreMessagesFromContext,
  storeChatContext,
} from '../utils/chatStorage';
import { cleanupAllWidgetElements } from '../utils/cleanupUtils';
import {
  getWidgetCustomize as getWidgetCustomizeConfig,
  getWidgetPosition as getWidgetPositionConfig,
  getWidgetText as getWidgetTextConfig,
} from '../utils/configGetters';
import { configManager } from '../utils/configManager';
import { logError, safeExecute, safeExecuteAsync } from '../utils/errorUtils';
import { createLogger } from '../utils/logger';
import {
  findTaskMessageIndex,
  parseProgressLines,
  reconstructMessageContent,
  removeThinkingMarkers,
} from '../utils/messageContentUtils';
import {
  createAgentMessage,
  createErrorMessage,
  createPlaceholderMessage,
  createSystemMessage,
  createUserMessage,
} from '../utils/messageFactory';
import { updateThinkingMarker } from '../utils/progressLineManager';
import { addMessage, removeMessage, updateMessage } from '../utils/stateUtils';
import { isBrowser } from '../utils/typeGuards';

const log = createLogger('Widget');

interface UseWidgetProps {
  config?: MarketrixConfig;
}

/**
 * Main widget hook that manages widget state, WebSocket connections, and message handling
 *
 * @param config - Optional Marketrix configuration. If not provided, returns default empty state.
 * @returns Widget state, actions, configuration, and helper methods
 *
 * @example
 * ```tsx
 * const { state, actions, settings } = useWidget({ config });
 * ```
 */
export const useWidget = ({ config }: UseWidgetProps = {}) => {
  if (!config) {
    const defaultSettings = DEFAULT_WIDGET_SETTINGS;
    return {
      state: {
        isOpen: false,
        isMinimized: false,
        isLoading: false,
        messages: [],
        currentMode: 'tell' as InstructionType,
        agentAvailable: false,
        error: undefined,
        activeTaskId: null,
        isTaskRunning: false,
        taskProgress: [],
      },
      actions: {
        toggleWidget: () => {},
        closeWidget: () => {},
        setMode: () => {},
        sendMessage: async () => {},
        stopTask: async () => {},
        clearError: () => {},
        addMessage: () => {},
        updateMessage: () => {},
        removeMessage: () => {},
      },
      marketrixConfig: null,
      settings: defaultSettings,
      shouldShow: false,
      getWidgetText: () => ({
        greeting: defaultSettings.widget_greeting,
        placeholder: 'Ask anything',
        header_ai: defaultSettings.widget_header,
        header_live: 'Live Agent',
        body_ai: defaultSettings.widget_body,
        body_live: 'A live agent will be with you shortly.',
        chat_greeting: 'Welcome to our chat! How can I assist you?',
        tour_greeting: 'Welcome! Let me show you around.',
      }),
      getWidgetCustomize: () => ({
        colors: {
          primary: defaultSettings.widget_accent_color,
          secondary: defaultSettings.widget_secondary_color,
          background: defaultSettings.widget_background_color,
          text: defaultSettings.widget_text_color,
          border: defaultSettings.widget_border_color,
        },
        sizes: {
          width: defaultSettings.widget_width,
          height: defaultSettings.widget_height,
          border_radius: defaultSettings.widget_border_radius,
          font_size: defaultSettings.widget_font_size,
        },
        animations: {
          slide_duration: defaultSettings.widget_animation_duration,
          fade_duration: defaultSettings.widget_fade_duration,
          bounce_effect: defaultSettings.widget_bounce_effect,
        },
      }),
      getWidgetPosition: () => ({
        position: defaultSettings.widget_position,
        offset: DEFAULT_MARKETRIX_CONFIG.widget_position_offset,
        z_index: DEFAULT_MARKETRIX_CONFIG.widget_position_z_index,
      }),
    };
  }
  // Widget UI state
  const [state, setState] = useState<WidgetState>({
    isOpen: false,
    isMinimized: false,
    isLoading: false,
    messages: [],
    currentMode: 'tell',
    agentAvailable: false,
    activeTaskId: null,
    isTaskRunning: false,
    taskProgress: [],
  });

  // Service references
  const apiServiceRef = useRef<MarketrixApiService | null>(null);
  const websocketServiceRef = useRef<WebSocketService | null>(null);

  // Initialization state tracking
  const initializationInProgressRef = useRef<boolean>(false);
  const initializedChatIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef<boolean>(false);

  /**
   * Merged configuration with defaults
   */
  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    const mergedConfig = {
      ...DEFAULT_MARKETRIX_CONFIG,
      ...config, // Config from index.tsx overrides defaults
    };
    configManager.saveConfig(mergedConfig);
    return mergedConfig;
  }, [config]);

  /**
   * Check if initialization should be skipped
   */
  const shouldSkipInitialization = useCallback((): boolean => {
    // If already initialized with the same chat_id and websocket is connected, skip
    if (
      websocketServiceRef.current &&
      initializedChatIdRef.current &&
      websocketServiceRef.current.isConnected() &&
      websocketServiceRef.current.getChatId() === initializedChatIdRef.current
    ) {
      log.debug('Already initialized and connected, skipping re-initialization');
      hasInitializedRef.current = true;
      return true;
    }

    // Prevent multiple simultaneous initializations
    if (initializationInProgressRef.current) {
      log.debug('Initialization already in progress, skipping...');
      return true;
    }

    return false;
  }, []);

  /**
   * Restore chat context from storage
   */
  const restoreChatContext = useCallback((chatId: string): void => {
    const storedContext = getStoredChatContext(chatId);
    if (!storedContext) {
      return;
    }

    log.debug('Restoring context from storage:', {
      messageCount: storedContext.messages.length,
      isTaskRunning: storedContext.isTaskRunning,
      activeTaskId: storedContext.activeTaskId,
      currentMode: storedContext.currentMode,
    });

    const restoredMessages = restoreMessagesFromContext(storedContext);

    // Clean up messages: remove thinking markers and validate progress lines
    const cleanedMessages = restoredMessages.map((msg) => {
      const cleanContent = removeThinkingMarkers(msg.content);
      const { mainContent, progressLines } = parseProgressLines(cleanContent);
      const validProgressLines = progressLines.filter((line) => line.trim().length > 0);
      const finalContent = reconstructMessageContent(mainContent, validProgressLines);

      return {
        ...msg,
        content: finalContent,
      };
    });

    setState((prev) => ({
      ...prev,
      messages: cleanedMessages,
      isTaskRunning: storedContext.isTaskRunning,
      activeTaskId: storedContext.activeTaskId,
      taskProgress: storedContext.taskProgress,
      currentMode: storedContext.currentMode,
      isOpen: storedContext.isOpen ?? false,
      isMinimized: storedContext.isMinimized ?? false,
    }));
  }, []);

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
          initializedChatIdRef,
          websocketServiceRef
        ),
        onToolCallProgress: createToolCallProgressCallback(),
        onMessage: createMessageHandler(setState),
        onError: createErrorHandler(setState),
      };

      // Initialize or update WebSocket service
      if (!websocketServiceRef.current) {
        websocketServiceRef.current = WebSocketService.getInstance(config, websocketCallbacks);
      } else {
        websocketServiceRef.current.setCallbacks(websocketCallbacks);
      }
    },
    [config]
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
      initializedChatIdRef.current = chatId;
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
        initializedChatIdRef.current = chatId;
        log.info('WebSocket connection initiated');
      } catch (wsError) {
        log.error('Failed to connect websocket:', wsError);
      }
    } else {
      initializedChatIdRef.current = chatId;
    }
  }, []);

  /**
   * Initialize chat session and WebSocket connection
   */
  const initializeChatSession = useCallback(async (): Promise<void> => {
    if (!apiServiceRef.current) {
      initializationInProgressRef.current = false;
      return;
    }

    try {
      // Initialize chat ID
      const chatId = await apiServiceRef.current.initializeChatId();
      log.info('Chat ID initialized:', chatId);

      // Restore context from storage if available
      restoreChatContext(chatId);

      // Skip if already connected with this chat_id
      if (
        websocketServiceRef.current &&
        websocketServiceRef.current.getChatId() === chatId &&
        websocketServiceRef.current.isConnected()
      ) {
        log.debug('WebSocket already connected with this chat_id, skipping');
        initializedChatIdRef.current = chatId;
        initializationInProgressRef.current = false;
        return;
      }

      // Setup WebSocket connection
      setupWebSocketConnection(chatId);

      // Connect WebSocket
      await connectWebSocket(chatId);
    } catch (error) {
      log.error('Failed to initialize chat_id:', error);
    } finally {
      initializationInProgressRef.current = false;
      hasInitializedRef.current = true;
    }
  }, [restoreChatContext, setupWebSocketConnection, connectWebSocket]);

  // ============================================================================
  // Initialization Effect
  // ============================================================================

  /**
   * Initialize API service and WebSocket connection
   * Handles chat ID initialization, context restoration, and WebSocket setup
   */
  useEffect(() => {
    // Handle reconnection if already initialized
    if (hasInitializedRef.current) {
      if (
        websocketServiceRef.current &&
        initializedChatIdRef.current &&
        !websocketServiceRef.current.isConnected() &&
        !initializationInProgressRef.current
      ) {
        const chatId = initializedChatIdRef.current;
        log.debug('WebSocket disconnected, attempting to reconnect...');
        initializationInProgressRef.current = true;
        websocketServiceRef.current
          .connect(chatId)
          .finally(() => {
            initializationInProgressRef.current = false;
          })
          .catch((error) => {
            log.error('Reconnection failed:', error);
          });
      }
      return;
    }

    // Skip initialization if conditions are met
    if (shouldSkipInitialization()) {
      return;
    }

    initializationInProgressRef.current = true;

    // Initialize or update API service
    if (!apiServiceRef.current) {
      apiServiceRef.current = new MarketrixApiService(config);
    } else {
      apiServiceRef.current.updateConfig(config);
    }

    // Initialize chat session and WebSocket connection
    initializeChatSession();

    // Check agent availability on mount
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

    // Cleanup websocket only on unmount (not on config change)
    return () => {
      // Only cleanup on actual unmount, not on every config change
      // The websocket should persist across config updates
    };
  }, [config]);

  // ============================================================================
  // Task State Monitoring
  // ============================================================================

  /**
   * Monitor task state and add/remove "Thinking..." indicator
   * Only shows thinking indicator for show/do modes when task is running
   */
  useEffect(() => {
    if (!state.isTaskRunning || (state.currentMode !== 'show' && state.currentMode !== 'do')) {
      // Remove thinking indicator if task is not running or not in show/do mode
      setState((prev) => {
        const hasThinkingMessages = prev.messages.some(
          (msg) =>
            msg.sender === 'agent' &&
            !msg.isSystemMessage &&
            !msg.isScreenAccessRequest &&
            !msg.isPlaceholder &&
            msg.content.includes('__THINKING__')
        );
        if (!hasThinkingMessages) return prev;

        const updatedMessages = prev.messages.map((msg) => {
          if (
            msg.sender === 'agent' &&
            !msg.isSystemMessage &&
            !msg.isScreenAccessRequest &&
            !msg.isPlaceholder &&
            msg.content.includes('__THINKING__')
          ) {
            return {
              ...msg,
              content: msg.content.replace(/\n\n__THINKING__$/, ''),
            };
          }
          return msg;
        });
        return { ...prev, messages: updatedMessages };
      });
      return;
    }

    // Find the last agent message (task message) and update thinking marker
    setState((prev) => {
      const messages = [...prev.messages];
      const taskMessageIndex = findTaskMessageIndex(messages);

      if (taskMessageIndex >= 0) {
        const taskMessage = messages[taskMessageIndex];
        const updatedMessage = updateThinkingMarker(
          taskMessage,
          state.isTaskRunning,
          state.currentMode
        );

        if (updatedMessage !== taskMessage) {
          const updatedMessages = [...messages];
          updatedMessages[taskMessageIndex] = updatedMessage;
          return { ...prev, messages: updatedMessages };
        }
      }

      return prev;
    });
  }, [state.isTaskRunning, state.currentMode]);

  // ============================================================================
  // Context Persistence
  // ============================================================================

  /**
   * Auto-save chat context to localStorage when state changes
   * Debounced to avoid excessive writes
   */
  useEffect(() => {
    const chatId = initializedChatIdRef.current;
    if (!chatId || !hasInitializedRef.current) {
      return;
    }

    // Debounce saves to avoid excessive localStorage writes
    const timeoutId = setTimeout(() => {
      storeChatContext(
        chatId,
        state.messages,
        state.isTaskRunning,
        state.activeTaskId,
        state.taskProgress,
        state.currentMode,
        state.isOpen,
        state.isMinimized
      );
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    state.messages,
    state.isTaskRunning,
    state.activeTaskId,
    state.taskProgress,
    state.currentMode,
    state.isOpen,
    state.isMinimized,
  ]);

  // ============================================================================
  // Page Lifecycle Handling
  // ============================================================================

  /**
   * Handle page unload/visibility changes to stop screen sharing
   * Ensures screen sharing is properly stopped when page is hidden or unloaded
   */
  useEffect(() => {
    const handlePageUnload = () => {
      // Check if screen sharing is active
      if (isScreenSharing()) {
        log.debug('Page unloading, stopping screen share and adding message');

        // Stop screen sharing
        stopScreenShare();

        // Remove any screenshare messages (with videoStream) from chat history
        // Get current state synchronously and update immediately
        setState((prev) => {
          // Remove screenshare messages (messages with videoStream)
          const messagesWithoutScreenshare = prev.messages.filter((msg) => !msg.videoStream);

          // Add "Stopped screenshare" message to chat history
          const stoppedMessage = createSystemMessage(
            'Stopped screenshare',
            'show',
            'user',
            'screenshare-stopped'
          );

          const updatedMessages = [...messagesWithoutScreenshare, stoppedMessage];

          // Immediately save to storage to ensure it's persisted before page unloads
          const chatId = initializedChatIdRef.current;
          if (chatId) {
            try {
              // Save synchronously to localStorage
              storeChatContext(
                chatId,
                updatedMessages,
                prev.isTaskRunning,
                prev.activeTaskId,
                prev.taskProgress,
                prev.currentMode,
                prev.isOpen,
                prev.isMinimized
              );
            } catch (error) {
              log.warn('Failed to save stopped screenshare message:', error);
            }
          }

          return {
            ...prev,
            messages: updatedMessages,
          };
        });
      }
    };

    // Listen to page lifecycle events
    // Use pagehide for better reliability (fires even when page is cached)
    // pagehide is more reliable than beforeunload for saving state
    window.addEventListener('pagehide', handlePageUnload);

    // Also handle visibility change (when tab becomes hidden)
    // This catches cases where the page is hidden but not unloaded
    const handleVisibilityChange = () => {
      if (document.hidden && isScreenSharing()) {
        log.debug('Page hidden, stopping screen share and adding message');
        handlePageUnload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Cleanup effect that runs only on unmount
   * Disconnects WebSocket and resets initialization flags
   */
  useEffect(() => {
    return () => {
      if (websocketServiceRef.current) {
        log.debug('Cleaning up websocket connection on unmount');
        websocketServiceRef.current.disconnect();
        websocketServiceRef.current = null;
      }
      initializedChatIdRef.current = null;
      initializationInProgressRef.current = false;
      hasInitializedRef.current = false;
    };
  }, []);

  // ============================================================================
  // Widget UI Actions
  // ============================================================================

  /**
   * Toggle widget open/closed state
   */
  const toggleWidget = useCallback(() => {
    setState((prev) => {
      // If opening from minimized state, clear minimized
      // If closing, keep minimized state
      return {
        ...prev,
        isOpen: !prev.isOpen,
        isMinimized: prev.isOpen ? prev.isMinimized : false,
      };
    });
  }, []);

  /**
   * Close widget and set to minimized state
   */
  const closeWidget = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: true, // Set minimized when closed
    }));
  }, []);

  /**
   * Set the current interaction mode (show, tell, do)
   */
  const setMode = useCallback((mode: InstructionType) => {
    setState((prev) => ({ ...prev, currentMode: mode }));
  }, []);

  /**
   * Send a message to the agent
   *
   * @param content - Message content
   * @param mode - Optional mode override (defaults to current mode)
   * @param connectionId - Optional connection ID for tour mode
   * @param question - Optional question for tour mode
   * @param skipUserMessage - If true, don't add user message to chat (already added)
   */
  const sendMessage = useCallback(
    async (
      content: string,
      mode?: InstructionType,
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean
    ) => {
      if (!apiServiceRef.current || !content.trim()) return;

      const messageMode = mode || state.currentMode;
      const messageId = Date.now().toString();

      // Create placeholder message for thinking state
      const placeholderMessage = createPlaceholderMessage(messageMode);
      const placeholderMessageId = placeholderMessage.id;

      // Only add user message if it wasn't already added (e.g., from chip click)
      if (!skipUserMessage) {
        const userMessage = createUserMessage(content, messageMode);

        // Add user message and placeholder immediately
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage, placeholderMessage],
          isLoading: true,
        }));
      } else {
        // Message already added, just add placeholder and set loading state
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, placeholderMessage],
          isLoading: true,
        }));
      }

      try {
        const response = await apiServiceRef.current.sendMessage({
          message: content.trim(),
          mode: messageMode,
          connection_id: connectionId,
          question,
        });

        // For show/do modes, check if task_id is in response and start tracking
        const isTaskMode = messageMode === 'show' || messageMode === 'do';
        let taskId: string | null = null;

        // Try to extract task_id from response if available
        if (
          isTaskMode &&
          response &&
          'task_id' in response &&
          typeof response.task_id === 'string'
        ) {
          taskId = response.task_id;
        }

        // For show/do modes, log the task start
        if (isTaskMode) {
          log.debug(`Task started: ${response.response}`);
        }

        const agentMessage = createAgentMessage(
          response.response,
          response.mode,
          response.messageId
        );

        // Override timestamp from API response if provided
        if (response.timestamp) {
          agentMessage.timestamp = response.timestamp;
        }

        log.debug(`Adding agent message: "${agentMessage.content}" (id: ${agentMessage.id})`);

        // Replace placeholder message with actual response
        // Preserve any progress lines that were added to the placeholder
        setState((prev) => {
          const placeholderMsg = prev.messages.find((msg) => msg.id === placeholderMessageId);
          let finalAgentMessage = agentMessage;

          // If placeholder has progress lines (content with \n\n), preserve them
          if (placeholderMsg?.content.includes('\n\n')) {
            const parts = placeholderMsg.content.split('\n\n');
            if (parts.length > 1) {
              const progressLines = parts.slice(1);
              finalAgentMessage = {
                ...agentMessage,
                content: [agentMessage.content, ...progressLines].join('\n\n'),
              };
            }
          }

          const newMessages = prev.messages.map((msg) =>
            msg.id === placeholderMessageId ? finalAgentMessage : msg
          );
          log.debug(
            `State updated with ${newMessages.length} messages. Last message: "${newMessages[newMessages.length - 1].content}"`
          );
          return {
            ...prev,
            messages: newMessages,
            isLoading: false,
            // Set task state for show/do modes
            ...(isTaskMode && taskId
              ? {
                  activeTaskId: taskId,
                  isTaskRunning: true,
                  taskProgress: [],
                }
              : {}),
          };
        });
      } catch (error) {
        log.error('Failed to send message:', error);

        // Extract error message - prefer API error details if available
        let userFriendlyError = 'Sorry, I encountered an error. Please try again.';
        const errorMsg = error instanceof Error ? error.message : String(error);

        // If error contains API error details, use them
        if (errorMsg.includes('API returned status')) {
          // Extract the actual error message after the status
          // Format: "API returned status 500. No tell-mode rule found!"
          const apiErrorMatch = errorMsg.match(/API returned status \d+\. (.+?)(?:\.|$)/);
          if (apiErrorMatch && apiErrorMatch.length > 1) {
            const apiError = apiErrorMatch[1].trim();
            // Make it more user-friendly
            if (apiError.includes('No tell-mode rule found')) {
              userFriendlyError = 'Sorry, the tell mode is not configured. Please contact support.';
            } else if (apiError.includes('No show-mode rule found')) {
              userFriendlyError = 'Sorry, the show mode is not configured. Please contact support.';
            } else if (apiError.includes('No do-mode rule found')) {
              userFriendlyError = 'Sorry, the do mode is not configured. Please contact support.';
            } else {
              userFriendlyError = `Sorry, ${apiError.toLowerCase()}`;
            }
          }
        } else if (errorMsg.includes('API request failed')) {
          // Extract the actual error from "API request failed: <error>"
          const actualError = errorMsg.replace('API request failed: ', '').trim();
          if (actualError) {
            userFriendlyError = `Sorry, ${actualError.toLowerCase()}`;
          }
        }

        const errorMessage = createErrorMessage(userFriendlyError, messageMode, messageId);

        // Remove placeholder message on error
        setState((prev) => {
          const newMessages = prev.messages.filter(
            (msg) => !(msg.isPlaceholder && msg.id.startsWith('placeholder-'))
          );
          return {
            ...prev,
            messages: [...newMessages, errorMessage],
            isLoading: false,
            error: 'Failed to send message',
          };
        });
      }
    },
    [state.currentMode]
  );

  /**
   * Stop the currently running task
   */
  const stopTask = useCallback(async () => {
    if (!apiServiceRef.current || !state.activeTaskId) return;

    try {
      await apiServiceRef.current.stopTask(state.activeTaskId);
      setState((prev) => ({
        ...prev,
        activeTaskId: null,
        isTaskRunning: false,
        isLoading: false,
      }));
    } catch (error) {
      logError('stopTask', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to stop task',
      }));
    }
  }, [state.activeTaskId]);

  /**
   * Clear the current error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: undefined }));
  }, []);

  const addMessageCallback = useCallback((message: ChatMessage) => {
    addMessage(setState, message);
  }, []);

  const updateMessageCallback = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    updateMessage(setState, messageId, updates);
  }, []);

  const removeMessageCallback = useCallback((messageId: string) => {
    removeMessage(setState, messageId);
  }, []);

  /**
   * Clear all chat history and reset widget state
   * Stops running tasks, screen sharing, and clears all stored state
   */
  const clearChatHistory = useCallback(async () => {
    const chatId = initializedChatIdRef.current;

    // Stop any running tasks before clearing state
    if (chatId && apiServiceRef.current && (state.isTaskRunning || state.activeTaskId)) {
      const apiService = apiServiceRef.current;
      await safeExecuteAsync(
        async () => {
          log.debug('Stopping active task before clearing');
          // Stop task without taskId to stop all tasks for this chat_id
          await apiService.stopTask();
        },
        'Failed to stop task during clear (continuing anyway)',
        undefined
      );
    }

    // Stop screenshare if active
    if (isScreenSharing()) {
      log.debug('Stopping screenshare on reset');
      stopScreenShare();
    }

    // Clean up any pending tool call overlays
    cleanup();

    // Clean up all widget DOM elements using consolidated utility
    cleanupAllWidgetElements();

    // Clear all stored state
    if (chatId) {
      clearChatContext();
      clearPendingToolCall();
    }

    // Clear chat ID storage as well to force a fresh chat ID on next initialization
    if (isBrowser()) {
      safeExecute(
        () => {
          localStorage.removeItem('marketrix_chat_id');
        },
        'Failed to clear chat ID from localStorage',
        undefined
      );
    }

    // Reset widget state to initial values
    // Keep isOpen and isMinimized to preserve the widget's expanded state
    setState((prev) => ({
      ...prev,
      messages: [],
      isTaskRunning: false,
      activeTaskId: null,
      taskProgress: [],
      // Preserve widget UI state (isOpen and isMinimized)
      currentMode: 'tell',
      error: undefined,
    }));

    // Reset initialization flags to force re-initialization
    initializedChatIdRef.current = null;
    hasInitializedRef.current = false;

    log.info('Widget reset - all stored state cleared');
  }, [state.isTaskRunning, state.activeTaskId]);

  const shouldShowWidget = useCallback(() => {
    return configManager.shouldShowWidget();
  }, []);

  // Get specific configuration values using extracted getters
  const getWidgetText = useCallback(() => {
    return getWidgetTextConfig(marketrixConfig);
  }, [marketrixConfig]);

  /**
   * Get widget customization configuration (colors, sizes, animations)
   */
  const getWidgetCustomize = useCallback(() => {
    return getWidgetCustomizeConfig(marketrixConfig);
  }, [marketrixConfig]);

  /**
   * Get widget position configuration
   */
  const getWidgetPosition = useCallback(() => {
    return getWidgetPositionConfig(marketrixConfig);
  }, [marketrixConfig]);

  /**
   * Get effective settings (from flat config)
   */
  const effectiveSettings = useMemo<WidgetSettingsData>(() => {
    return extractWidgetSettingsFromConfig(marketrixConfig);
  }, [marketrixConfig]);

  // ============================================================================
  // Return Value
  // ============================================================================

  return {
    // State
    state,
    marketrixConfig,
    settings: effectiveSettings,

    // Actions
    actions: {
      toggleWidget,
      closeWidget,
      setMode,
      sendMessage,
      stopTask,
      clearError,
      addMessage: addMessageCallback,
      updateMessage: updateMessageCallback,
      removeMessage: removeMessageCallback,
      clearChatHistory,
    },

    // Computed values
    shouldShow: shouldShowWidget(),

    // Configuration getters
    getWidgetText,
    getWidgetCustomize,
    getWidgetPosition,
  };
};

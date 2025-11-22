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
  getAnyStoredChatContext,
  getPendingToolCall,
  getStoredChatContext,
  getStoredChatId,
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
  hasProgressLines,
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

  // Ref to store latest state for synchronous access (e.g., in page unload handlers)
  const stateRef = useRef<WidgetState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Ref to track previous task running state to detect task completion
  const prevIsTaskRunningRef = useRef<boolean>(state.isTaskRunning);
  // Ref to track previous messages to detect when new messages are added
  const prevMessagesRef = useRef<ChatMessage[]>(state.messages);

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
   * Handles chat ID changes gracefully by preserving history and appending a system message
   * Note: This may be called after early restoration, so we check if messages already exist
   */
  const restoreChatContext = useCallback((chatId: string): void => {
    const storedContext = getStoredChatContext(chatId);
    if (!storedContext) {
      log.debug('No stored context found for restoration');
      return;
    }

    const chatIdChanged = storedContext.chat_id !== chatId;

    // Count system messages for logging
    const systemMessageCount = storedContext.messages.filter((m) => m.isSystemMessage).length;
    log.debug('Restoring context from storage:', {
      messageCount: storedContext.messages.length,
      systemMessageCount,
      isTaskRunning: storedContext.isTaskRunning,
      activeTaskId: storedContext.activeTaskId,
      currentMode: storedContext.currentMode,
      isOpen: storedContext.isOpen,
      isMinimized: storedContext.isMinimized,
      chatIdChanged,
      storedChatId: storedContext.chat_id,
      currentChatId: chatId,
    });

    // Check if messages were already restored early
    setState((prev) => {
      const alreadyHasMessages = prev.messages.length > 0;

      // If messages already exist and chat ID hasn't changed, don't overwrite
      if (alreadyHasMessages && !chatIdChanged) {
        log.debug('Messages already restored, skipping restoration');
        return prev;
      }

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

      // If chat ID changed, append context change message (but only if one doesn't already exist)
      // Filter out any existing "Chat context changed" messages first to avoid duplicates
      let finalMessages = cleanedMessages;
      if (chatIdChanged) {
        // Remove any existing "Chat context changed" messages to avoid duplicates
        const messagesWithoutContextChange = (
          alreadyHasMessages ? prev.messages : cleanedMessages
        ).filter((msg) => !(msg.isSystemMessage && msg.content === 'Chat context changed'));

        // Check if a context change message already exists
        const hasContextChangeMessage = messagesWithoutContextChange.some(
          (msg) => msg.isSystemMessage && msg.content === 'Chat context changed'
        );

        if (!hasContextChangeMessage) {
          // Append context change message only if one doesn't exist
          const contextChangeMessage = createSystemMessage(
            'Chat context changed',
            storedContext.currentMode,
            'agent',
            'context-changed'
          );
          finalMessages = [...messagesWithoutContextChange, contextChangeMessage];
          log.debug('Chat ID changed, appended context change message');
        } else {
          finalMessages = messagesWithoutContextChange;
          log.debug('Chat ID changed, but context change message already exists, skipping');
        }
      }

      // When chat ID changes, reset task state (tasks are tied to specific chat IDs)
      // But preserve messages and mode
      return {
        ...prev,
        messages: finalMessages,
        // Only restore task state if chat ID hasn't changed (tasks are chat-specific)
        isTaskRunning: chatIdChanged ? false : storedContext.isTaskRunning,
        activeTaskId: chatIdChanged ? null : storedContext.activeTaskId,
        taskProgress: chatIdChanged ? [] : storedContext.taskProgress,
        currentMode: storedContext.currentMode,
        isOpen: storedContext.isOpen ?? prev.isOpen, // Preserve current state if not stored
        isMinimized: storedContext.isMinimized ?? prev.isMinimized, // Preserve current state if not stored
      };
    });
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
    // Try to restore FULL context (including messages) early, before chat ID initialization
    // This ensures the widget appears in the correct state immediately on page load
    // We get the stored context directly without requiring a chat ID match
    const storedContext = getAnyStoredChatContext();
    if (storedContext) {
      log.info('Restoring FULL context early from storage:', {
        messageCount: storedContext.messages.length,
        isOpen: storedContext.isOpen,
        isMinimized: storedContext.isMinimized,
        storedChatId: storedContext.chat_id,
        isTaskRunning: storedContext.isTaskRunning,
        currentMode: storedContext.currentMode,
      });

      // Restore messages immediately
      const restoredMessages = restoreMessagesFromContext(storedContext);
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

      // Filter out "Chat context changed" messages from early restoration
      // These are transient and will be re-added by restoreChatContext if needed
      const messagesWithoutContextChange = cleanedMessages.filter(
        (msg) => !(msg.isSystemMessage && msg.content === 'Chat context changed')
      );

      // Restore full state immediately (synchronously) if available
      setState((prev) => ({
        ...prev,
        messages: messagesWithoutContextChange,
        isTaskRunning: storedContext.isTaskRunning,
        activeTaskId: storedContext.activeTaskId,
        taskProgress: storedContext.taskProgress,
        currentMode: storedContext.currentMode,
        isOpen: storedContext.isOpen ?? prev.isOpen,
        isMinimized: storedContext.isMinimized ?? prev.isMinimized,
      }));

      // Log system messages for verification
      const systemMessages = messagesWithoutContextChange.filter((m) => m.isSystemMessage);
      log.info('Early context restoration complete', {
        messageCount: messagesWithoutContextChange.length,
        systemMessageCount: systemMessages.length,
        restoredMessageIds: messagesWithoutContextChange.map((m) => m.id).slice(0, 5),
        systemMessages: systemMessages.map((m) => ({ id: m.id, content: m.content })),
        filteredContextChangeMessages: cleanedMessages.length - messagesWithoutContextChange.length,
      });
    } else {
      log.debug('No stored context found for early restoration');
    }

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
   * Monitor task state and update placeholder state
   * Switches placeholder between 'thinking' and 'waiting-for-user' states
   */
  useEffect(() => {
    setState((prev) => {
      const messages = [...prev.messages];
      let updated = false;

      // Find placeholder messages and update their state
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.isPlaceholder && msg.sender === 'agent' && !msg.isSystemMessage) {
          // Determine placeholder state based on:
          // - 'waiting-for-user': task is running in show/do mode and has progress lines
          // - 'thinking': otherwise (agent is processing)
          const hasProgress = hasProgressLines(msg.content);
          const shouldBeWaitingForUser =
            prev.isTaskRunning &&
            (prev.currentMode === 'show' || prev.currentMode === 'do') &&
            hasProgress;

          const newState: 'thinking' | 'waiting-for-user' = shouldBeWaitingForUser
            ? 'waiting-for-user'
            : 'thinking';

          if (msg.placeholderState !== newState) {
            messages[i] = {
              ...msg,
              placeholderState: newState,
            };
            updated = true;
          }
        }
      }

      // Also handle non-placeholder messages with thinking markers
      if (!prev.isTaskRunning || (prev.currentMode !== 'show' && prev.currentMode !== 'do')) {
        // Remove thinking indicator if task is not running or not in show/do mode
        const hasThinkingMessages = messages.some(
          (msg) =>
            msg.sender === 'agent' &&
            !msg.isSystemMessage &&
            !msg.isScreenAccessRequest &&
            !msg.isPlaceholder &&
            msg.content.includes('__THINKING__')
        );
        if (hasThinkingMessages) {
          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (
              msg.sender === 'agent' &&
              !msg.isSystemMessage &&
              !msg.isScreenAccessRequest &&
              !msg.isPlaceholder &&
              msg.content.includes('__THINKING__')
            ) {
              messages[i] = {
                ...msg,
                content: msg.content.replace(/\n\n__THINKING__$/, ''),
              };
              updated = true;
            }
          }
        }
      } else {
        // Find the last agent message (task message) and update thinking marker
        const taskMessageIndex = findTaskMessageIndex(messages);

        if (taskMessageIndex >= 0) {
          const taskMessage = messages[taskMessageIndex];
          const updatedMessage = updateThinkingMarker(
            taskMessage,
            prev.isTaskRunning,
            prev.currentMode
          );

          if (updatedMessage !== taskMessage) {
            messages[taskMessageIndex] = updatedMessage;
            updated = true;
          }
        }
      }

      return updated ? { ...prev, messages } : prev;
    });
  }, [state.isTaskRunning, state.currentMode, state.messages]);

  // ============================================================================
  // Context Persistence
  // ============================================================================

  /**
   * Auto-save chat context to localStorage when state changes
   * Uses shorter debounce for critical updates (task progress) and longer for UI state
   * Saves immediately when screenshare is active and task is running, when task just completed/failed,
   * or when new messages are added (especially important for tell mode)
   */
  useEffect(() => {
    const chatId = initializedChatIdRef.current;
    if (!chatId || !hasInitializedRef.current) {
      return;
    }

    // Track previous state to detect changes
    const taskJustCompleted = prevIsTaskRunningRef.current && !state.isTaskRunning;
    const newMessagesAdded = state.messages.length > prevMessagesRef.current.length;

    // Update refs for next comparison
    prevIsTaskRunningRef.current = state.isTaskRunning;
    prevMessagesRef.current = state.messages;

    // Save immediately (no debounce) in these critical cases:
    // 1. Screenshare is active and task is running
    // 2. Task just completed/failed (transition from running to not running)
    // 3. New messages were added (important for tell mode and all modes)
    if ((isScreenSharing() && state.isTaskRunning) || taskJustCompleted || newMessagesAdded) {
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
      log.debug('Immediate save:', {
        reason: taskJustCompleted
          ? 'task completed/failed'
          : newMessagesAdded
            ? 'new messages added'
            : 'screenshare active and task running',
        isTaskRunning: state.isTaskRunning,
        messageCount: state.messages.length,
        previousMessageCount: prevMessagesRef.current.length,
      });
      return;
    }

    // Use shorter debounce for critical state changes (task progress, messages)
    // and longer debounce for UI state changes (isOpen, isMinimized)
    const isCriticalUpdate =
      state.messages.length > 0 || state.isTaskRunning || state.taskProgress.length > 0;
    const debounceMs = isCriticalUpdate ? 200 : 500;

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
    }, debounceMs);

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
   * Handle page unload/visibility changes to stop screen sharing and save context
   * Ensures screen sharing is properly stopped and chat context is saved before page unloads
   */
  useEffect(() => {
    const handlePageUnload = () => {
      const chatId = initializedChatIdRef.current;
      if (!chatId) {
        return;
      }

      // Get current state synchronously using ref to access latest state
      // Since setState is async, we use the ref to get the most recent state
      const currentState = stateRef.current;

      // Check if screen sharing is active
      if (isScreenSharing()) {
        log.debug('Page unloading, stopping screen share and preserving chat history');

        // Stop screen sharing
        stopScreenShare();

        // Remove screenshare messages (with videoStream) but keep ALL other messages
        const messagesWithoutScreenshare = currentState.messages.filter((msg) => !msg.videoStream);

        // Check if "Stopped screenshare" message already exists to avoid duplicates
        const hasStoppedMessage = messagesWithoutScreenshare.some(
          (msg) =>
            msg.id === 'screenshare-stopped' ||
            (msg.isSystemMessage && msg.content === 'Stopped screenshare')
        );

        // Only add the message if it doesn't already exist
        let updatedMessages = messagesWithoutScreenshare;
        if (!hasStoppedMessage) {
          // Add "Stopped screenshare" message to chat history (append, don't replace)
          const stoppedMessage = createSystemMessage(
            'Stopped screenshare',
            'show',
            'user',
            'screenshare-stopped'
          );
          updatedMessages = [...messagesWithoutScreenshare, stoppedMessage];
        }

        // Save the updated state synchronously BEFORE page unloads
        // This is critical for form submits which navigate very quickly
        try {
          storeChatContext(
            chatId,
            updatedMessages,
            currentState.isTaskRunning,
            currentState.activeTaskId,
            currentState.taskProgress,
            currentState.currentMode,
            currentState.isOpen,
            currentState.isMinimized
          );
          log.debug('Saved chat context with stopped screenshare message on page unload');
        } catch (error) {
          log.warn('Failed to save chat context on page unload:', error);
        }

        // Also update stateRef so if there's any delay, the ref has the latest state
        stateRef.current = {
          ...currentState,
          messages: updatedMessages,
        };
      } else {
        // No screenshare active, just save current state
        try {
          storeChatContext(
            chatId,
            currentState.messages,
            currentState.isTaskRunning,
            currentState.activeTaskId,
            currentState.taskProgress,
            currentState.currentMode,
            currentState.isOpen,
            currentState.isMinimized
          );
          log.debug('Saved chat context on page unload');
        } catch (error) {
          log.warn('Failed to save chat context on page unload:', error);
        }
      }
    };

    // Listen to page lifecycle events
    // Use both beforeunload (fires earlier, gives more time) and pagehide (more reliable for cached pages)
    // beforeunload fires when navigation starts, giving us time to save before page unloads
    // pagehide is more reliable for cached pages and mobile browsers
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);

    // Also handle visibility change (when tab becomes hidden)
    // This catches cases where the page is hidden but not unloaded
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Save state when page becomes hidden (especially important for screenshare tasks)
        const chatId = initializedChatIdRef.current;
        if (chatId) {
          try {
            const currentState = stateRef.current;
            storeChatContext(
              chatId,
              currentState.messages,
              currentState.isTaskRunning,
              currentState.activeTaskId,
              currentState.taskProgress,
              currentState.currentMode,
              currentState.isOpen,
              currentState.isMinimized
            );
            log.debug('Saved chat context on visibility change (page hidden)');
          } catch (error) {
            log.warn('Failed to save chat context on visibility change:', error);
          }
        }

        // If screenshare is active, also handle stopping it
        if (isScreenSharing()) {
          log.debug('Page hidden, stopping screen share and adding message');
          handlePageUnload();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handlePageUnload);
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
      const newState = {
        ...prev,
        isOpen: !prev.isOpen,
        isMinimized: prev.isOpen ? prev.isMinimized : false,
      };

      // Save state immediately when toggled to ensure it's persisted
      // Try to get chatId from ref first, then from storage if not available
      let chatId = initializedChatIdRef.current;
      if (!chatId) {
        chatId = getStoredChatId();
      }

      // Save state even if widget isn't fully initialized yet
      // This ensures state is persisted when clicking description card before initialization
      if (chatId) {
        try {
          storeChatContext(
            chatId,
            newState.messages,
            newState.isTaskRunning,
            newState.activeTaskId,
            newState.taskProgress,
            newState.currentMode,
            newState.isOpen,
            newState.isMinimized
          );
          log.debug('Saved widget state immediately after toggle', {
            chatId,
            isOpen: newState.isOpen,
            isMinimized: newState.isMinimized,
            wasInitialized: hasInitializedRef.current,
          });
        } catch (error) {
          log.warn('Failed to save widget state after toggle:', error);
        }
      } else {
        log.debug('Cannot save widget state: no chatId available yet');
      }

      return newState;
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

        // For show/do modes, update the placeholder with the agent message content
        // but keep it as a placeholder so tool calls can update it
        // For tell mode, replace the placeholder immediately
        if (isTaskMode) {
          // Keep placeholder but update its content with the agent message
          setState((prev) => {
            const placeholderMsg = prev.messages.find((msg) => msg.id === placeholderMessageId);
            if (placeholderMsg) {
              // Update placeholder with agent message content, preserving any existing progress lines
              const existingContent = placeholderMsg.content || '';
              const { progressLines } = parseProgressLines(existingContent);

              // Use agent message content as main content, keep existing progress lines
              const updatedContent = reconstructMessageContent(agentMessage.content, progressLines);

              const updatedMessages = prev.messages.map((msg) =>
                msg.id === placeholderMessageId
                  ? {
                      ...msg,
                      content: updatedContent,
                      // Keep as placeholder so tool calls can update it
                    }
                  : msg
              );

              log.debug(
                `Updated placeholder with agent message content. Message count: ${updatedMessages.length}`
              );

              return {
                ...prev,
                messages: updatedMessages,
                isLoading: false,
                // Set task state for show/do modes
                ...(taskId
                  ? {
                      activeTaskId: taskId,
                      isTaskRunning: true,
                      taskProgress: [],
                    }
                  : {}),
              };
            }

            // Fallback: if placeholder not found, replace it
            const newMessages = prev.messages.map((msg) =>
              msg.id === placeholderMessageId ? agentMessage : msg
            );
            return {
              ...prev,
              messages: newMessages,
              isLoading: false,
              ...(taskId
                ? {
                    activeTaskId: taskId,
                    isTaskRunning: true,
                    taskProgress: [],
                  }
                : {}),
            };
          });
        } else {
          // For tell mode, replace placeholder immediately
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
            };
          });
        }
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

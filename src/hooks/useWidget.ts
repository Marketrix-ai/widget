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
import { restoreEarlyState, restoreStateForChatId } from '../services/stateRestorationService';
import {
  createErrorHandler,
  createMessageHandler,
  createStatusChangeHandler,
  createToolCallProgressCallback,
} from '../services/websocketMessageHandlers';
import { WebSocketService } from '../services/websocketService';
import type { ChatMessage, MarketrixConfig, WidgetState } from '../types';
import {
  CHAT_CONTEXT_STORAGE_KEY,
  clearChatContext,
  clearPendingToolCall,
  getPendingToolCall,
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
import { initializationState } from '../utils/initializationState';
import { createLogger } from '../utils/logger';
import {
  findTaskMessageIndex,
  hasProgressLines,
  parseProgressLines,
  reconstructMessageContent,
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
  // Ref to track last saved state to prevent duplicate saves
  const lastSavedStateRef = useRef<{
    isOpen: boolean;
    isMinimized: boolean;
    messageCount: number;
    isTaskRunning: boolean;
    activeTaskId: string | null;
    taskProgressLength: number;
    taskProgressHash: string; // Hash of taskProgress to detect changes
  } | null>(null);

  // Service references
  const apiServiceRef = useRef<MarketrixApiService | null>(null);
  const websocketServiceRef = useRef<WebSocketService | null>(null);

  // Ref for chat ID (for status change handler compatibility)
  const chatIdRef = useRef<string | null>(null);

  // Restoration state tracking (local to this hook instance)
  const isRestoringContextRef = useRef<boolean>(false);

  // Ref to track if initialization has been attempted (prevents multiple effect runs)
  const initializationAttemptedRef = useRef<boolean>(false);

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
   * Check if initialization should be skipped (silent version)
   * Used internally to avoid logging on every check
   */
  const shouldSkipInitializationSilent = useCallback((): boolean => {
    return initializationState.shouldSkipInitializationSilent(
      () => websocketServiceRef.current?.getChatId() ?? null,
      () => websocketServiceRef.current?.isConnected() ?? false
    );
  }, []);

  /**
   * Restore chat context from storage using restoration service
   */
  const restoreChatContext = useCallback((chatId: string): void => {
    // Set flag to prevent saves during restoration
    isRestoringContextRef.current = true;

    setState((prev) => {
      const restoredState = restoreStateForChatId(chatId, prev);

      if (!restoredState) {
        // No restoration needed
        isRestoringContextRef.current = false;
        return prev;
      }

      // Clear restoration flag after state update
      setTimeout(() => {
        isRestoringContextRef.current = false;
      }, 100);

      return {
        ...prev,
        messages: restoredState.messages,
        isTaskRunning: restoredState.isTaskRunning,
        activeTaskId: restoredState.activeTaskId,
        taskProgress: restoredState.taskProgress,
        currentMode: restoredState.currentMode,
        isOpen: restoredState.isOpen ?? prev.isOpen,
        isMinimized: restoredState.isMinimized ?? prev.isMinimized,
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
          chatIdRef,
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

  // ============================================================================
  // Initialization Effect
  // ============================================================================

  /**
   * Initialize API service and WebSocket connection
   * Handles chat ID initialization, context restoration, and WebSocket setup
   */
  useEffect(() => {
    // Prevent early restoration from running multiple times
    if (initializationState.getEarlyRestorationDone()) {
      return;
    }
    // Set flag immediately to prevent concurrent executions
    initializationState.markEarlyRestorationDone();

    // Try to restore FULL context (including messages) early, before chat ID initialization
    // This ensures the widget appears in the correct state immediately on page load
    const restoredState = restoreEarlyState();
    if (restoredState) {
      // Set flag to prevent saves during restoration
      isRestoringContextRef.current = true;

      // Restore full state immediately (synchronously) if available
      setState((prev) => ({
        ...prev,
        messages: restoredState.messages,
        isTaskRunning: restoredState.isTaskRunning,
        activeTaskId: restoredState.activeTaskId,
        taskProgress: restoredState.taskProgress,
        currentMode: restoredState.currentMode,
        isOpen: restoredState.isOpen ?? prev.isOpen,
        isMinimized: restoredState.isMinimized ?? prev.isMinimized,
      }));

      // Clear restoration flag after a short delay to allow state to settle
      setTimeout(() => {
        isRestoringContextRef.current = false;
      }, 100);
    }
  }, []); // Empty dependency array - only run once on mount

  // Separate effect for handling reconnection and initialization
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

    // Cleanup websocket only on unmount (not on config change)
    return () => {
      // Only cleanup on actual unmount, not on every config change
      // The websocket should persist across config updates
      // Note: Don't reset initializationAttemptedRef here as it should persist
    };
  }, [config]); // Only depend on config - callbacks are stable

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
   * Prevents duplicate saves by tracking last saved state
   */
  useEffect(() => {
    const chatId = initializationState.getChatId();
    if (!chatId || !initializationState.getComplete()) {
      return;
    }

    // Skip saves during context restoration
    if (isRestoringContextRef.current) {
      return;
    }

    // Track previous state to detect changes
    const taskJustCompleted = prevIsTaskRunningRef.current && !state.isTaskRunning;

    // Check if messages actually changed (not just length, but content)
    const messagesChanged =
      state.messages.length !== prevMessagesRef.current.length ||
      state.messages.some((msg, idx) => {
        const prevMsg = prevMessagesRef.current[idx];
        return !prevMsg || msg.id !== prevMsg.id || msg.content !== prevMsg.content;
      });

    const newMessagesAdded =
      state.messages.length > prevMessagesRef.current.length && messagesChanged;

    // Check if UI state actually changed
    const lastSaved = lastSavedStateRef.current;
    const uiStateChanged =
      !lastSaved ||
      lastSaved.isOpen !== state.isOpen ||
      lastSaved.isMinimized !== state.isMinimized;

    // Check if task progress changed (by comparing hash)
    const taskProgressHash = JSON.stringify(state.taskProgress);
    const taskProgressChanged =
      !lastSaved ||
      lastSaved.taskProgressLength !== state.taskProgress.length ||
      lastSaved.taskProgressHash !== taskProgressHash;

    // Check if critical state changed
    const criticalStateChanged =
      !lastSaved ||
      lastSaved.messageCount !== state.messages.length ||
      lastSaved.isTaskRunning !== state.isTaskRunning ||
      lastSaved.activeTaskId !== state.activeTaskId ||
      taskProgressChanged;

    // Update refs for next comparison
    prevIsTaskRunningRef.current = state.isTaskRunning;
    prevMessagesRef.current = state.messages;

    // Save immediately (no debounce) in these critical cases:
    // 1. Screenshare is active and task is running
    // 2. Task just completed/failed (transition from running to not running)
    // 3. New messages were added (important for tell mode and all modes)
    // 4. Task progress changed (important for ongoing tasks)
    if (
      (isScreenSharing() && state.isTaskRunning) ||
      taskJustCompleted ||
      newMessagesAdded ||
      taskProgressChanged
    ) {
      // Only save if state actually changed
      if (criticalStateChanged || uiStateChanged) {
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
        lastSavedStateRef.current = {
          isOpen: state.isOpen,
          isMinimized: state.isMinimized,
          messageCount: state.messages.length,
          isTaskRunning: state.isTaskRunning,
          activeTaskId: state.activeTaskId,
          taskProgressLength: state.taskProgress.length,
          taskProgressHash,
        };
        log.debug('Immediate save:', {
          reason: taskJustCompleted
            ? 'task completed/failed'
            : newMessagesAdded
              ? 'new messages added'
              : taskProgressChanged
                ? 'task progress changed'
                : 'screenshare active and task running',
          isTaskRunning: state.isTaskRunning,
          messageCount: state.messages.length,
          taskProgressLength: state.taskProgress.length,
        });
      }
      return;
    }

    // Use shorter debounce for critical state changes (task progress, messages)
    // and longer debounce for UI state changes (isOpen, isMinimized)
    const isCriticalUpdate =
      state.messages.length > 0 || state.isTaskRunning || state.taskProgress.length > 0;
    const debounceMs = isCriticalUpdate ? 200 : 500;

    const timeoutId = setTimeout(() => {
      // Only save if state actually changed
      if (criticalStateChanged || uiStateChanged) {
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
        lastSavedStateRef.current = {
          isOpen: state.isOpen,
          isMinimized: state.isMinimized,
          messageCount: state.messages.length,
          isTaskRunning: state.isTaskRunning,
          activeTaskId: state.activeTaskId,
          taskProgressLength: state.taskProgress.length,
          taskProgressHash: JSON.stringify(state.taskProgress),
        };
      }
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
      const chatId = initializationState.getChatId();
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
        const chatId = initializationState.getChatId();
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

    // Handle storage events from other tabs/windows
    // This allows state to be synchronized across multiple tabs
    const handleStorageChange = (e: StorageEvent) => {
      // Only handle our storage key
      if (e.key === CHAT_CONTEXT_STORAGE_KEY && e.newValue) {
        try {
          const updatedContext = JSON.parse(e.newValue);
          const currentChatId = initializationState.getChatId();

          // If the updated context is for the same chat ID, restore it
          if (updatedContext.chat_id === currentChatId && currentChatId) {
            log.debug('Storage updated from another tab, restoring context');
            restoreChatContext(currentChatId);
          }
        } catch (error) {
          log.warn('Failed to parse storage event data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('beforeunload', handlePageUnload);
      window.removeEventListener('pagehide', handlePageUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [restoreChatContext]);

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
      // Note: Don't reset initializationState here as it's a singleton
      // that should persist across component remounts
    };
  }, []);

  // ============================================================================
  // Widget UI Actions
  // ============================================================================

  /**
   * Toggle widget open/closed state
   * State persistence is handled by the context persistence useEffect
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
      if (!content.trim()) {
        log.warn('Attempted to send empty message');
        return;
      }

      const messageMode = mode || state.currentMode;
      const messageId = Date.now().toString();

      // Create placeholder message for thinking state
      const placeholderMessage = createPlaceholderMessage(messageMode);
      const placeholderMessageId = placeholderMessage.id;

      // Only add user message if it wasn't already added (e.g., from chip click)
      if (!skipUserMessage) {
        const userMessage = createUserMessage(content, messageMode);

        // Add user message and placeholder immediately for immediate feedback
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

      // Ensure API service is initialized
      if (!apiServiceRef.current) {
        log.warn('API service not initialized, initializing now...');
        apiServiceRef.current = new MarketrixApiService(config);
      }

      // Ensure chat session is initialized
      if (!initializationState.getComplete() || !initializationState.getChatId()) {
        log.info('Chat session not initialized, initializing now...');
        try {
          await initializeChatSession();
        } catch (initError) {
          log.error('Failed to initialize chat session:', initError);
          // Remove placeholder and show error
          setState((prev) => {
            const newMessages = prev.messages.filter((msg) => msg.id !== placeholderMessageId);
            const errorMessage = createErrorMessage(
              'Failed to initialize chat. Please try again.',
              messageMode,
              messageId
            );
            return {
              ...prev,
              messages: [...newMessages, errorMessage],
              isLoading: false,
            };
          });
          return;
        }
      }

      // Double-check after initialization
      if (!apiServiceRef.current) {
        log.error('Failed to initialize API service');
        setState((prev) => {
          const newMessages = prev.messages.filter((msg) => msg.id !== placeholderMessageId);
          const errorMessage = createErrorMessage(
            'Failed to initialize chat. Please try again.',
            messageMode,
            messageId
          );
          return {
            ...prev,
            messages: [...newMessages, errorMessage],
            isLoading: false,
          };
        });
        return;
      }

      // Ensure chat ID is available
      let chatId: string;
      try {
        chatId = await apiServiceRef.current.getOrCreateChatId();
        if (!chatId) {
          throw new Error('Failed to get or create chat ID');
        }
      } catch (chatIdError) {
        log.error('Failed to get or create chat ID:', chatIdError);
        setState((prev) => {
          const newMessages = prev.messages.filter((msg) => msg.id !== placeholderMessageId);
          const errorMessage = createErrorMessage(
            'Failed to initialize chat session. Please try again.',
            messageMode,
            messageId
          );
          return {
            ...prev,
            messages: [...newMessages, errorMessage],
            isLoading: false,
          };
        });
        return;
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
    [state.currentMode, config, initializeChatSession]
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
    const chatId = initializationState.getChatId();

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
    initializationState.reset();

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

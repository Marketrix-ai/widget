import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  DEFAULT_MARKETRIX_CONFIG,
  DEFAULT_WIDGET_SETTINGS,
  extractWidgetSettingsFromConfig,
} from '../constants/config';
import type { InstructionType, WidgetSettingsData } from '../sdk';
import MarketrixApiService from '../services/marketrixApiService';
import { sendMessage as sendMessageService } from '../services/messageHandlingService';
import { isScreenSharing, stopScreenShare } from '../services/screenShareService';
import { cleanup } from '../services/showModeService';
import { restoreState } from '../services/stateRestorationService';
import { widgetStateManager } from '../services/widgetStateManager';
import type { ChatMessage, MarketrixConfig } from '../types';
import { clearChatContext, clearPendingToolCall } from '../utils/chatStorage';
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
import { addMessage, removeMessage, updateMessage } from '../utils/stateUtils';
import { isBrowser } from '../utils/typeGuards';
import { useChatInitialization } from './useChatInitialization';
import { useContextPersistence } from './useContextPersistence';
import { usePageLifecycle } from './usePageLifecycle';
import { useTaskState } from './useTaskState';
import { useWidgetState } from './useWidgetState';

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

  // Core state management
  const { state, stateRef, actions: stateActions } = useWidgetState();

  // Ref to track the active message that should receive tool call progress updates
  const activeMessageRef = useRef<ChatMessage | null>(null);

  // Restoration state tracking (local to this hook instance)
  const isRestoringContextRef = useRef<boolean>(false);

  // Sync refs with state manager when they change
  // Note: We update state manager directly in code where refs are modified
  // These useEffects are for initial sync only
  useEffect(() => {
    widgetStateManager.setActiveMessage(activeMessageRef.current);
    widgetStateManager.setIsRestoring(isRestoringContextRef.current);
  }, []);

  // Merged configuration with defaults
  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    const mergedConfig = {
      ...DEFAULT_MARKETRIX_CONFIG,
      ...config, // Config from index.tsx overrides defaults
    };
    configManager.saveConfig(mergedConfig);
    return mergedConfig;
  }, [config]);

  // Chat initialization (handles WebSocket, API service, restoration)
  const { apiServiceRef, websocketServiceRef, chatIdRef } = useChatInitialization({
    config: marketrixConfig,
    setState: stateActions.setState,
    isRestoring: isRestoringContextRef,
    activeMessageRef,
  });

  // Context persistence (auto-saves state to localStorage)
  useContextPersistence(state, isRestoringContextRef);

  // Task state monitoring (updates placeholder states)
  useTaskState(state, stateActions.setState);

  // Restore chat context callback for page lifecycle
  const restoreChatContext = useCallback(
    (chatId: string): void => {
      isRestoringContextRef.current = true;
      stateActions.setState((prev) => {
        const restoredState = restoreState(chatId, prev);

        if (!restoredState) {
          isRestoringContextRef.current = false;
          return prev;
        }

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
    },
    [stateActions]
  );

  // Page lifecycle handling (unload, visibility, storage sync)
  usePageLifecycle(stateRef, restoreChatContext);

  // Initialize chat session callback for message handling
  const initializeChatSession = useCallback(async (): Promise<void> => {
    if (!apiServiceRef.current) {
      initializationState.markComplete();
      return;
    }

    if (!initializationState.markInProgress()) {
      return;
    }

    if (initializationState.getComplete() && initializationState.getChatId()) {
      return;
    }

    try {
      const chatId = await apiServiceRef.current.getOrCreateChatId();

      if (initializationState.getChatId() === chatId && initializationState.getComplete()) {
        initializationState.markComplete();
        return;
      }

      initializationState.setChatId(chatId);
      chatIdRef.current = chatId;
      widgetStateManager.setChatId(chatId);

      if (!initializationState.getEarlyRestorationDone()) {
        restoreChatContext(chatId);
      }

      if (
        websocketServiceRef.current &&
        websocketServiceRef.current.getChatId() === chatId &&
        websocketServiceRef.current.isConnected()
      ) {
        initializationState.markComplete();
        return;
      }

      // Setup and connect WebSocket (handled by useChatInitialization)
      if (websocketServiceRef.current) {
        await websocketServiceRef.current.connect(chatId);
      }
    } catch (error) {
      log.error('Failed to initialize chat_id:', error);
    } finally {
      initializationState.markComplete();
    }
  }, [apiServiceRef, websocketServiceRef, chatIdRef, restoreChatContext]);

  // Send message action
  const sendMessage = useCallback(
    async (
      content: string,
      mode?: InstructionType,
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean
    ) => {
      await sendMessageService(
        { content, mode, connectionId, question, skipUserMessage },
        {
          state,
          setState: stateActions.setState,
          config: marketrixConfig,
          apiService: apiServiceRef.current || new MarketrixApiService(marketrixConfig),
          activeMessageRef,
          initializeChatSession,
        }
      );
    },
    [state, stateActions, marketrixConfig, apiServiceRef, initializeChatSession]
  );

  // Stop task action
  const stopTask = useCallback(async () => {
    if (!apiServiceRef.current) return;

    if (state.activeTaskId) {
      try {
        await apiServiceRef.current.stopTask(state.activeTaskId);
      } catch (error) {
        logError('stopTask', error);
      }
    }

    // Clean up messages and state when stopping
    stateActions.setState((prev) => {
      const updatedMessages = prev.messages.map((msg) => {
        const contentWithoutThinking = msg.content
          .replace(/\n\n__THINKING__$/, '')
          .replace(/__THINKING__/g, '');

        if (msg.isPlaceholder) {
          return {
            ...msg,
            content: contentWithoutThinking,
            isPlaceholder: false,
            placeholderState: undefined,
          };
        }

        if (contentWithoutThinking !== msg.content) {
          return {
            ...msg,
            content: contentWithoutThinking,
          };
        }

        return msg;
      });

      activeMessageRef.current = null;
      widgetStateManager.setActiveMessage(null);

      return {
        ...prev,
        activeTaskId: null,
        isTaskRunning: false,
        isLoading: false,
        messages: updatedMessages,
      };
    });
  }, [state.activeTaskId, stateActions, apiServiceRef]);

  // Clear chat history action
  const clearChatHistory = useCallback(async () => {
    const chatId = initializationState.getChatId();

    if (chatId && apiServiceRef.current && (state.isTaskRunning || state.activeTaskId)) {
      const apiService = apiServiceRef.current;
      await safeExecuteAsync(
        async () => {
          log.debug('Stopping active task before clearing');
          await apiService.stopTask();
        },
        'Failed to stop task during clear (continuing anyway)',
        undefined
      );
    }

    if (isScreenSharing()) {
      log.debug('Stopping screenshare on reset');
      stopScreenShare();
    }

    cleanup();
    cleanupAllWidgetElements();

    if (chatId) {
      clearChatContext();
      clearPendingToolCall();
    }

    if (isBrowser()) {
      safeExecute(
        () => {
          localStorage.removeItem('marketrix_chat_id');
        },
        'Failed to clear chat ID from localStorage',
        undefined
      );
    }

    stateActions.resetState();
    initializationState.reset();

    log.info('Widget reset - all stored state cleared');
  }, [state.isTaskRunning, state.activeTaskId, stateActions]);

  // Message management callbacks
  const addMessageCallback = useCallback(
    (message: ChatMessage) => {
      addMessage(stateActions.setState, message);
    },
    [stateActions]
  );

  const updateMessageCallback = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      updateMessage(stateActions.setState, messageId, updates);
    },
    [stateActions]
  );

  const removeMessageCallback = useCallback(
    (messageId: string) => {
      removeMessage(stateActions.setState, messageId);
    },
    [stateActions]
  );

  // Configuration getters
  const shouldShowWidget = useCallback(() => {
    return configManager.shouldShowWidget();
  }, []);

  const getWidgetText = useCallback(() => {
    return getWidgetTextConfig(marketrixConfig);
  }, [marketrixConfig]);

  const getWidgetCustomize = useCallback(() => {
    return getWidgetCustomizeConfig(marketrixConfig);
  }, [marketrixConfig]);

  const getWidgetPosition = useCallback(() => {
    return getWidgetPositionConfig(marketrixConfig);
  }, [marketrixConfig]);

  // Effective settings
  const effectiveSettings = useMemo<WidgetSettingsData>(() => {
    return extractWidgetSettingsFromConfig(marketrixConfig);
  }, [marketrixConfig]);

  return {
    // State
    state,
    marketrixConfig,
    settings: effectiveSettings,

    // Actions
    actions: {
      toggleWidget: stateActions.toggleWidget,
      closeWidget: stateActions.closeWidget,
      setMode: stateActions.setMode,
      sendMessage,
      stopTask,
      clearError: stateActions.clearError,
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_MARKETRIX_CONFIG,
  DEFAULT_WIDGET_SETTINGS,
  extractWidgetSettingsFromConfig,
} from '../constants/config';
import type { WidgetSettingsData } from '../sdk';
import MarketrixApiService from '../services/marketrixApiService';
import { type WebSocketMessage, WebSocketService } from '../services/websocketService';
import type { ChatMessage, ChatMode, MarketrixConfig, WidgetState } from '../types';
import { configManager } from '../utils/configManager';

interface UseWidgetProps {
  config?: MarketrixConfig;
}

export const useWidget = ({ config }: UseWidgetProps = {}) => {
  if (!config) {
    const defaultSettings = DEFAULT_WIDGET_SETTINGS;
    return {
      state: {
        isOpen: false,
        isMinimized: false,
        isLoading: false,
        messages: [],
        currentMode: 'tell' as ChatMode,
        agentAvailable: false,
        error: undefined,
      },
      actions: {
        toggleWidget: () => {},
        closeWidget: () => {},
        setMode: () => {},
        sendMessage: async () => {},
        clearError: () => {},
        addMessage: () => {},
        updateMessage: () => {},
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
  });

  const apiServiceRef = useRef<MarketrixApiService | null>(null);
  const websocketServiceRef = useRef<WebSocketService | null>(null);
  const initializationInProgressRef = useRef<boolean>(false);
  const initializedChatIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef<boolean>(false);

  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    const mergedConfig = {
      ...DEFAULT_MARKETRIX_CONFIG,
      ...config, // Config from index.tsx overrides defaults
    };
    configManager.saveConfig(mergedConfig);
    return mergedConfig;
  }, [config]);

  // Initialize API service and websocket connection (only once on mount)
  useEffect(() => {
    // If we've already initialized, only handle reconnection if needed
    if (hasInitializedRef.current) {
      // If websocket exists but is disconnected, try to reconnect
      if (
        websocketServiceRef.current &&
        initializedChatIdRef.current &&
        !websocketServiceRef.current.isConnected() &&
        !initializationInProgressRef.current
      ) {
        const chatId = initializedChatIdRef.current;
        console.log('[Widget] WebSocket disconnected, attempting to reconnect...');
        initializationInProgressRef.current = true;
        websocketServiceRef.current
          .connect(chatId)
          .finally(() => {
            initializationInProgressRef.current = false;
          })
          .catch((error) => {
            console.error('[Widget] Reconnection failed:', error);
          });
      }
      return;
    }

    // Prevent multiple simultaneous initializations
    if (initializationInProgressRef.current) {
      console.log('[Widget] Initialization already in progress, skipping...');
      return;
    }

    // If already initialized with the same chat_id and websocket is connected, skip
    if (
      websocketServiceRef.current &&
      initializedChatIdRef.current &&
      websocketServiceRef.current.isConnected() &&
      websocketServiceRef.current.getChatId() === initializedChatIdRef.current
    ) {
      console.log('[Widget] Already initialized and connected, skipping re-initialization');
      hasInitializedRef.current = true;
      return;
    }

    initializationInProgressRef.current = true;

    if (!apiServiceRef.current) {
      apiServiceRef.current = new MarketrixApiService(config);
    } else {
      // Update config if service already exists (merge with existing config)
      apiServiceRef.current.updateConfig(config);
    }

    // Initialize chat_id and websocket connection
    const initializeChat = async () => {
      if (!apiServiceRef.current) {
        initializationInProgressRef.current = false;
        return;
      }

      try {
        const chatId = await apiServiceRef.current.initializeChatId();
        console.log('[Widget] Chat ID initialized:', chatId);

        // Skip if we already have a connection with this chat_id
        if (
          websocketServiceRef.current &&
          websocketServiceRef.current.getChatId() === chatId &&
          websocketServiceRef.current.isConnected()
        ) {
          console.log('[Widget] WebSocket already connected with this chat_id, skipping');
          initializedChatIdRef.current = chatId;
          initializationInProgressRef.current = false;
          return;
        }

        // Initialize websocket service if it doesn't exist (use singleton)
        if (!websocketServiceRef.current) {
          websocketServiceRef.current = WebSocketService.getInstance(config, {
            onStatusChange: (status) => {
              console.log('[Widget] WebSocket status changed:', status);
              // Update agent availability based on websocket status
              setState((prev) => ({
                ...prev,
                agentAvailable: status === 'registered' || status === 'connected',
              }));
            },
            onMessage: (message: WebSocketMessage) => {
              console.log('[Widget] WebSocket message received:', message);
              // Handle incoming websocket messages here if needed
              // For now, we'll just log them
            },
            onError: (error) => {
              console.error('[Widget] WebSocket error:', error);
              setState((prev) => ({
                ...prev,
                agentAvailable: false,
                error: error.message,
              }));
            },
          });
        } else {
          // Add callbacks if service already exists (singleton, so add instead of replace)
          websocketServiceRef.current.addCallbacks({
            onStatusChange: (status) => {
              console.log('[Widget] WebSocket status changed:', status);
              setState((prev) => ({
                ...prev,
                agentAvailable: status === 'registered' || status === 'connected',
              }));
            },
            onMessage: (message: WebSocketMessage) => {
              console.log('[Widget] WebSocket message received:', message);
            },
            onError: (error) => {
              console.error('[Widget] WebSocket error:', error);
              setState((prev) => ({
                ...prev,
                agentAvailable: false,
                error: error.message,
              }));
            },
          });
        }

        // Connect websocket with the chat_id
        if (chatId) {
          const currentChatId = websocketServiceRef.current.getChatId();
          if (currentChatId !== chatId) {
            // Only reconnect if chat_id changed
            if (currentChatId) {
              console.log('[Widget] Chat ID changed, reconnecting websocket...');
              websocketServiceRef.current.disconnect();
            }
            try {
              await websocketServiceRef.current.connect(chatId);
              initializedChatIdRef.current = chatId;
              console.log('[Widget] WebSocket connection initiated');
            } catch (wsError) {
              console.error('[Widget] Failed to connect websocket:', wsError);
            }
          } else if (!websocketServiceRef.current.isConnected()) {
            // If same chat_id but not connected, try to connect
            try {
              await websocketServiceRef.current.connect(chatId);
              initializedChatIdRef.current = chatId;
              console.log('[Widget] WebSocket reconnection initiated');
            } catch (wsError) {
              console.error('[Widget] Failed to reconnect websocket:', wsError);
            }
          } else {
            initializedChatIdRef.current = chatId;
          }
        }
      } catch (error) {
        console.error('[Widget] Failed to initialize chat_id:', error);
      } finally {
        initializationInProgressRef.current = false;
        hasInitializedRef.current = true;
      }
    };

    initializeChat();

    // Check agent availability on mount
    const checkAgentAvailability = async () => {
      if (!apiServiceRef.current) return;

      try {
        const available = await apiServiceRef.current.checkAgentAvailability();
        setState((prev) => ({ ...prev, agentAvailable: available }));
      } catch (error) {
        console.error('Failed to check agent availability:', error);
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

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      if (websocketServiceRef.current) {
        console.log('[Widget] Cleaning up websocket connection on unmount');
        websocketServiceRef.current.disconnect();
        websocketServiceRef.current = null;
      }
      initializedChatIdRef.current = null;
      initializationInProgressRef.current = false;
      hasInitializedRef.current = false;
    };
  }, []);

  // Widget UI actions
  const toggleWidget = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
      isMinimized: false,
    }));
  }, []);

  const closeWidget = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: false,
    }));
  }, []);

  const setMode = useCallback((mode: ChatMode) => {
    setState((prev) => ({ ...prev, currentMode: mode }));
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      mode?: ChatMode,
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean
    ) => {
      if (!apiServiceRef.current || !content.trim()) return;

      const messageMode = mode || state.currentMode;
      const messageId = Date.now().toString();

      // Only add user message if it wasn't already added (e.g., from chip click)
      if (!skipUserMessage) {
        const userMessage: ChatMessage = {
          id: messageId,
          content: content.trim(),
          sender: 'user',
          timestamp: new Date(),
          mode: messageMode,
        };

        // Add user message immediately
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage],
          isLoading: true,
        }));
      } else {
        // Message already added, just set loading state
        setState((prev) => ({
          ...prev,
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

        const agentMessage: ChatMessage = {
          id: response.messageId,
          content: response.response,
          sender: 'agent',
          timestamp: response.timestamp,
          mode: response.mode,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, agentMessage],
          isLoading: false,
        }));
      } catch (error) {
        console.error('Failed to send message:', error);

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

        const errorMessage: ChatMessage = {
          id: `error-${messageId}`,
          content: userFriendlyError,
          sender: 'agent',
          timestamp: new Date(),
          mode: messageMode,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          isLoading: false,
          error: 'Failed to send message',
        }));
      }
    },
    [state.currentMode]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: undefined }));
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg)),
    }));
  }, []);

  const shouldShowWidget = useCallback(() => {
    return configManager.shouldShowWidget();
  }, []);

  // Get specific configuration values
  const getWidgetText = useCallback(() => {
    // Text content comes from flat config (from API)
    const settings = extractWidgetSettingsFromConfig(marketrixConfig);
    return {
      greeting: settings.widget_greeting,
      placeholder: 'Ask anything', // Default placeholder (not in settings schema)
      header_ai: settings.widget_header,
      header_live: 'Live Agent', // Default live header (not in settings schema)
      body_ai: settings.widget_body,
      body_live: 'A live agent will be with you shortly.', // Default live body (not in settings schema)
      chat_greeting: settings.widget_body, // Use widget_body as chat greeting
      tour_greeting: settings.widget_greeting, // Use widget_greeting as tour greeting
    };
  }, [marketrixConfig]);

  // Derive customize from flat config (all styling comes from API)
  const getWidgetCustomize = useCallback(() => {
    const settings = extractWidgetSettingsFromConfig(marketrixConfig);
    return {
      colors: {
        primary: settings.widget_accent_color,
        secondary: settings.widget_secondary_color,
        background: settings.widget_background_color,
        text: settings.widget_text_color,
        border: settings.widget_border_color,
      },
      sizes: {
        width: settings.widget_width,
        height: settings.widget_height,
        border_radius: settings.widget_border_radius,
        font_size: settings.widget_font_size,
      },
      animations: {
        slide_duration: settings.widget_animation_duration,
        fade_duration: settings.widget_fade_duration,
        bounce_effect: settings.widget_bounce_effect,
      },
    };
  }, [marketrixConfig]);

  const getWidgetPosition = useCallback(() => {
    const settings = extractWidgetSettingsFromConfig(marketrixConfig);
    return {
      position: settings.widget_position,
      offset:
        marketrixConfig.widget_position_offset ?? DEFAULT_MARKETRIX_CONFIG.widget_position_offset,
      z_index:
        marketrixConfig.widget_position_z_index ?? DEFAULT_MARKETRIX_CONFIG.widget_position_z_index,
    };
  }, [marketrixConfig]);

  // Get effective settings (from flat config)
  const effectiveSettings = useMemo<WidgetSettingsData>(() => {
    return extractWidgetSettingsFromConfig(marketrixConfig);
  }, [marketrixConfig]);

  return {
    // Widget UI state
    state,
    actions: {
      toggleWidget,
      closeWidget,
      setMode,
      sendMessage,
      clearError,
      addMessage,
      updateMessage,
    },

    // Config state
    marketrixConfig,
    settings: effectiveSettings,

    // Computed values
    shouldShow: shouldShowWidget(),

    // Getter methods (styling-related)
    getWidgetText,
    getWidgetCustomize,
    getWidgetPosition,
  };
};

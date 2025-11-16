import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_MARKETRIX_CONFIG,
  DEFAULT_WIDGET_SETTINGS,
  extractWidgetSettingsFromConfig,
} from '../constants/config';
import type { WidgetSettingsData } from '../sdk';
import { IntegrationService } from '../services/integrationService';
import MarketrixApiService from '../services/marketrixApiService';
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
      isLoading: false,
      error: null,
      shouldShow: false,
      getWidgetText: () => ({
        greeting: defaultSettings.widget_greeting,
        placeholder: 'Show me...',
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

  // Settings loading state
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const apiServiceRef = useRef<MarketrixApiService | null>(null);

  // Fetch integration settings from API if marketrixId/marketrixKey provided
  // Skip if settings are already loaded in config (check for widget_enabled as indicator)
  useEffect(() => {
    const fetchSettings = async () => {
      // If widget settings are already in config (flat structure), skip fetching
      if (config.widget_enabled !== undefined) {
        console.log('Integration settings already loaded in config, skipping fetch');
        setSettingsLoaded(true);
        return;
      }

      if (config.marketrixId && config.marketrixKey) {
        try {
          setSettingsLoading(true);
          setSettingsError(null);

          const integrationService = new IntegrationService(
            config.marketrixId,
            config.marketrixKey
          );

          const integrationData = await integrationService.fetchIntegrationSettings();
          const integrationSettings = integrationData
            ? integrationService.getWidgetSettings(integrationData)
            : null;

          if (integrationSettings) {
            // Update config with fetched settings (spread flat structure)
            configManager.updateConfig({
              ...integrationSettings,
            });
            console.log('Integration settings loaded from API:', integrationSettings);
            setSettingsLoaded(true);
          } else {
            console.log('No integration settings found in API, using default settings');
            setSettingsLoaded(true);
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to fetch integration settings';
          setSettingsError(errorMessage);
          console.error('Error fetching integration settings:', err);
          setSettingsLoaded(true);
        } finally {
          setSettingsLoading(false);
        }
      } else {
        // If no marketrixId/marketrixKey, mark as loaded immediately
        setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [config.marketrixId, config.marketrixKey, config.widget_enabled]);

  // Merge config with ConfigManager settings (API settings may have been loaded)
  // Priority: config (with API settings) > configManager (localStorage) > defaults
  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    // Start with defaults
    let mergedConfig = { ...DEFAULT_MARKETRIX_CONFIG };

    // Merge with ConfigManager (may have old settings from localStorage)
    const managerConfig = configManager.getConfig();
    if (managerConfig) {
      mergedConfig = { ...mergedConfig, ...managerConfig };
    }

    // Config (with API settings from index.tsx) overrides everything
    mergedConfig = { ...mergedConfig, ...config };

    // If config has widget settings from API, save to ConfigManager for persistence
    if (config.widget_enabled !== undefined) {
      configManager.saveConfig(mergedConfig);
    }

    return mergedConfig;
  }, [config, settingsLoaded]);

  // Initialize API service
  useEffect(() => {
    if (!apiServiceRef.current) {
      apiServiceRef.current = new MarketrixApiService(config);
    } else {
      // Update config if service already exists (merge with existing config)
      apiServiceRef.current.updateConfig(config);
    }

    // Initialize chat_id
    const initializeChat = async () => {
      if (!apiServiceRef.current) return;

      try {
        const chatId = await apiServiceRef.current.initializeChatId();
        console.log('[Widget] Chat ID initialized:', chatId);
      } catch (error) {
        console.error('[Widget] Failed to initialize chat_id:', error);
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
  }, [config]);

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

        const errorMessage: ChatMessage = {
          id: `error-${messageId}`,
          content: 'Sorry, I encountered an error. Please try again.',
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
      placeholder: 'Show me...',
      header_ai: settings.widget_header,
      header_live: 'Live Agent',
      body_ai: settings.widget_body,
      body_live: 'A live agent will be with you shortly.',
      chat_greeting: 'Welcome to our chat! How can I assist you?',
      tour_greeting: 'Welcome! Let me show you around.',
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
    isLoading: settingsLoading,
    error: settingsError,

    // Computed values
    shouldShow: shouldShowWidget(),

    // Getter methods (styling-related)
    getWidgetText,
    getWidgetCustomize,
    getWidgetPosition,
  };
};

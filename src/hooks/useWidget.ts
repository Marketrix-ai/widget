import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_WIDGET_POSITION, DEFAULT_WIDGET_SETTINGS } from '../constants/config';
import type { WidgetSettingsData } from '../sdk';
import { IntegrationService } from '../services/integrationService';
import MarketrixApiService from '../services/marketrixApiService';
import type {
  ChatMessage,
  ChatMode,
  MarketrixConfig,
  WidgetAtmosphereConfig,
  WidgetState,
} from '../types';
import { configManager } from '../utils/configManager';

interface UseWidgetProps {
  config?: MarketrixConfig;
}

export const useWidget = ({ config }: UseWidgetProps = {}) => {
  if (!config) {
    // Return minimal defaults if no config provided
    const defaultSettings = DEFAULT_WIDGET_SETTINGS;
    return {
      state: {
        isOpen: false,
        isMinimized: false,
        isLoading: false,
        messages: [],
        currentMode: 'tell' as ChatMode,
        agentAvailable: false,
      },
      actions: {
        toggleWidget: () => {},
        closeWidget: () => {},
        setMode: () => {},
        sendMessage: async () => {},
        clearError: () => {},
      },
      atmosphereConfig: null,
      settings: defaultSettings,
      isLoading: false,
      error: null,
      marketrixConfig: null,
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
        ...DEFAULT_WIDGET_POSITION,
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

  const apiServiceRef = useRef<MarketrixApiService | null>(null);

  // Fetch integration settings from API if marketrixId/marketrixKey provided
  useEffect(() => {
    const fetchSettings = async () => {
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
            // Update atmosphere config with fetched settings
            configManager.updateConfig({
              widget_settings: integrationSettings,
            });
            console.log('Integration settings loaded from API:', integrationSettings);
          } else {
            console.log('No integration settings found in API, using default settings');
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to fetch integration settings';
          setSettingsError(errorMessage);
          console.error('Error fetching integration settings:', err);
        } finally {
          setSettingsLoading(false);
        }
      }
    };

    fetchSettings();
  }, [config.marketrixId, config.marketrixKey]);

  // Use atmosphere from config or load from configManager
  const atmosphereConfig = useMemo<WidgetAtmosphereConfig | null>(() => {
    if (config.atmosphere) {
      // Save to ConfigManager for runtime updates
      configManager.saveConfig(config.atmosphere);
      return config.atmosphere;
    }
    // Try to get from configManager (for runtime updates)
    const managerConfig = configManager.getConfig();
    if (managerConfig) {
      return managerConfig;
    }
    // If no config exists, load default from ConfigManager
    return configManager.loadConfig();
  }, [config]);

  // Initialize API service
  useEffect(() => {
    apiServiceRef.current = new MarketrixApiService(config);

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
  }, [config.marketrixId, config.marketrixKey, config.apiBaseUrl]);

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
    async (content: string, mode?: ChatMode, connectionId?: number, question?: string) => {
      if (!apiServiceRef.current || !content.trim()) return;

      const messageMode = mode || state.currentMode;
      const messageId = Date.now().toString();
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

  // Convert atmosphere config to MarketrixConfig
  const getMarketrixConfig = useCallback((): MarketrixConfig | null => {
    if (!atmosphereConfig) return null;

    return {
      ...config,
      atmosphere: atmosphereConfig,
    };
  }, [atmosphereConfig, config]);

  const shouldShowWidget = useCallback(() => {
    return configManager.shouldShowWidget();
  }, []);

  // Get specific configuration values
  const getWidgetText = useCallback(() => {
    // Text content comes from widget_settings (from API)
    const settings = atmosphereConfig?.widget_settings || DEFAULT_WIDGET_SETTINGS;
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
  }, [atmosphereConfig]);

  // Derive customize from widget_settings (all styling comes from API)
  const getWidgetCustomize = useCallback(() => {
    const settings = atmosphereConfig?.widget_settings || DEFAULT_WIDGET_SETTINGS;
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
  }, [atmosphereConfig]);

  const getWidgetPosition = useCallback(() => {
    const settings = atmosphereConfig?.widget_settings || DEFAULT_WIDGET_SETTINGS;
    return (
      atmosphereConfig?.widget_position || {
        position: settings.widget_position,
        ...DEFAULT_WIDGET_POSITION,
      }
    );
  }, [atmosphereConfig]);

  // Get effective settings (from API or atmosphere config)
  const effectiveSettings = useMemo<WidgetSettingsData>(() => {
    return atmosphereConfig?.widget_settings || DEFAULT_WIDGET_SETTINGS;
  }, [atmosphereConfig]);

  return {
    // Widget UI state
    state,
    actions: {
      toggleWidget,
      closeWidget,
      setMode,
      sendMessage,
      clearError,
    },

    // Atmosphere/config state
    atmosphereConfig,
    settings: effectiveSettings,
    isLoading: settingsLoading,
    error: settingsError,

    // Computed values
    marketrixConfig: getMarketrixConfig(),
    shouldShow: shouldShowWidget(),

    // Getter methods (styling-related)
    getWidgetText,
    getWidgetCustomize,
    getWidgetPosition,
  };
};

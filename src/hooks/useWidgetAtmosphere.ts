import { useCallback, useEffect, useState } from 'react';

import { IntegrationService } from '../services/integrationService';
import type { MarketrixConfig, WidgetAtmosphereConfig } from '../types';
import { configManager } from '../utils/ConfigManager';
import { isObject } from '../utils/typeGuards';

export const useWidgetAtmosphere = (initialConfig?: MarketrixConfig) => {
  const [atmosphereConfig, setAtmosphereConfig] = useState<WidgetAtmosphereConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrationService, setIntegrationService] = useState<IntegrationService | null>(null);

  // Initialize integration service when config is available
  useEffect(() => {
    if (initialConfig?.marketrixId && initialConfig?.marketrixKey) {
      const service = new IntegrationService(initialConfig.marketrixId, initialConfig.marketrixKey);
      setIntegrationService(service);
    }
  }, [initialConfig?.marketrixId, initialConfig?.marketrixKey, initialConfig?.apiBaseUrl]);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load base atmosphere config
        const config = await configManager.loadConfig();

        // Load integration settings if service is available
        if (integrationService) {
          console.log('Loading integration settings for atmosphere...');
          const integrationAtmosphereConfig = await integrationService.loadAtmosphereConfig();

          if (integrationAtmosphereConfig && isObject(integrationAtmosphereConfig)) {
            console.log('Integration atmosphere config loaded, merging with base config');
            // Merge integration settings with base config
            const updatedConfig = {
              ...config,
              ...integrationAtmosphereConfig,
            };
            setAtmosphereConfig(updatedConfig);
          } else {
            console.log('No integration atmosphere config found, using default config');
            setAtmosphereConfig(config);
          }
        } else {
          console.log('No integration service available, using default config');
          setAtmosphereConfig(config);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
        console.error('Error loading widget atmosphere config:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [integrationService]);

  // Subscribe to configuration changes
  useEffect(() => {
    const unsubscribe = configManager.subscribe((config) => {
      setAtmosphereConfig(config);
    });

    return unsubscribe;
  }, []);

  // Convert atmosphere config to MarketrixConfig
  const getMarketrixConfig = useCallback((): MarketrixConfig | null => {
    if (!atmosphereConfig) return null;

    const baseConfig = initialConfig || {
      marketrixId: 'default-id',
      marketrixKey: 'default-key',
    };

    return {
      ...baseConfig,
      ...configManager.toMarketrixConfig(atmosphereConfig),
    };
  }, [atmosphereConfig, initialConfig]);

  // Widget control methods
  const updateWidgetPosition = useCallback((position: 'bottom_right' | 'bottom_left') => {
    configManager.updateWidgetPosition(position);
  }, []);

  const updateWidgetVisibility = useCallback((visible: boolean) => {
    configManager.updateWidgetVisibility(visible);
  }, []);

  const updateWidgetMode = useCallback((mode: 'ai' | 'live' | 'hybrid') => {
    configManager.updateWidgetMode(mode);
  }, []);

  const updateAvatarStatus = useCallback((status: 'online' | 'offline' | 'busy') => {
    configManager.updateAvatarStatus(status);
  }, []);

  const updateStreamingAvatarStatus = useCallback(
    (status: 'idle' | 'typing' | 'speaking' | 'listening') => {
      configManager.updateStreamingAvatarStatus(status);
    },
    []
  );

  const updateSessionTime = useCallback((time: number) => {
    configManager.updateSessionTime(time);
  }, []);

  const updateRecordedTime = useCallback((time: number) => {
    configManager.updateRecordedTime(time);
  }, []);

  const toggleRecording = useCallback(() => {
    configManager.toggleRecording();
  }, []);

  const toggleSession = useCallback(() => {
    configManager.toggleSession();
  }, []);

  const shouldShowWidget = useCallback(() => {
    return configManager.shouldShowWidget();
  }, []);

  const startAutoRefresh = useCallback(() => {
    configManager.startAutoRefresh();
  }, []);

  const stopAutoRefresh = useCallback(() => {
    configManager.stopAutoRefresh();
  }, []);

  // Get specific configuration values
  const getWidgetText = useCallback(() => {
    return (
      atmosphereConfig?.widget_text || {
        greeting: 'Hello! How can I help you today?',
        placeholder: 'Show me...',
        header_ai: 'AI Assistant',
        header_live: 'Live Agent',
        body_ai: "I'm here to help you with any questions or tasks.",
        body_live: 'A live agent will be with you shortly.',
        chat_greeting: 'Welcome to our chat! How can I assist you?',
        tour_greeting: 'Welcome! Let me show you around.',
      }
    );
  }, [atmosphereConfig]);

  const getWidgetCustomize = useCallback(() => {
    return (
      atmosphereConfig?.widget_customize || {
        colors: {
          primary: '#1BB55B',
          secondary: '#987ADD',
          background: 'linear-gradient(135deg, #1BB55B26 0%, #987ADD30 100%)',
          text: '#333333',
          border: 'rgba(255, 255, 255, 0.2)',
        },
        sizes: {
          width: '320px',
          height: '35rem',
          border_radius: '12px',
          font_size: '14px',
        },
        animations: {
          slide_duration: '300ms',
          fade_duration: '200ms',
          bounce_effect: true,
        },
      }
    );
  }, [atmosphereConfig]);

  const getActiveAvatar = useCallback(() => {
    return (
      atmosphereConfig?.active_avatar || {
        url: 'https://example.com/avatar.png',
        name: 'Marketrix Assistant',
        status: 'online',
      }
    );
  }, [atmosphereConfig]);

  const getWidgetPosition = useCallback(() => {
    return (
      atmosphereConfig?.widget_position || {
        position: 'bottom_right' as const,
        offset: { x: 20, y: 20 },
        z_index: 40,
      }
    );
  }, [atmosphereConfig]);

  const getAdvancedSettings = useCallback(() => {
    return (
      atmosphereConfig?.advanced_settings || {
        auto_open_delay: 0,
        session_timeout: 1800000,
        max_messages: 100,
        typing_indicator: true,
        read_receipts: true,
        sound_notifications: true,
        vibration_enabled: true,
      }
    );
  }, [atmosphereConfig]);

  const getWidgetSettings = useCallback(() => {
    return (
      atmosphereConfig?.widget_settings || {
        widget_enabled: true,
        widget_appearance: 'default' as const,
        widget_position: 'bottom_right' as const,
        widget_device: 'desktop_mobile' as const,
        widget_header: '🤖 AI Assistant',
        widget_body: "I'm here to help you with any questions or tasks.",
        widget_greeting: "🎉 Welcome! I'm your AI assistant!",
        widget_feature_tell: true,
        widget_feature_show: true,
        widget_feature_do: true,
        widget_feature_request_human: true,
        widget_background_color: 'linear-gradient(135deg, #1BB55B45 0%, #987ADD45 100%)',
        widget_text_color: '#333333',
        widget_border_color: 'rgba(255, 255, 255, 0.3)',
        widget_accent_color: '#1BB55B',
        widget_secondary_color: '#987ADD',
        widget_border_radius: '12px',
        widget_font_size: '14px',
        widget_width: '360px',
        widget_height: '35rem',
        widget_shadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        widget_animation_duration: '300ms',
        widget_fade_duration: '200ms',
        widget_bounce_effect: true,
        widget_z_index: 40,
        widget_chips: [],
      }
    );
  }, [atmosphereConfig]);

  return {
    // State
    atmosphereConfig,
    isLoading,
    error,

    // Computed values
    marketrixConfig: getMarketrixConfig(),
    shouldShow: shouldShowWidget(),

    // Control methods
    updateWidgetPosition,
    updateWidgetVisibility,
    updateWidgetMode,
    updateAvatarStatus,
    updateStreamingAvatarStatus,
    updateSessionTime,
    updateRecordedTime,
    toggleRecording,
    toggleSession,
    startAutoRefresh,
    stopAutoRefresh,

    // Getter methods
    getWidgetText,
    getWidgetCustomize,
    getActiveAvatar,
    getWidgetPosition,
    getAdvancedSettings,
    getWidgetSettings,
  };
};

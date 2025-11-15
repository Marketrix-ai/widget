import { useCallback, useMemo } from 'react';

import { DEFAULT_WIDGET_POSITION, DEFAULT_WIDGET_SETTINGS } from '../config';
import type { MarketrixConfig, WidgetAtmosphereConfig } from '../types';
import { configManager } from '../utils/ConfigManager';

export const useWidgetAtmosphere = (initialConfig?: MarketrixConfig) => {
  // Use atmosphere from config or load from configManager
  const atmosphereConfig = useMemo<WidgetAtmosphereConfig | null>(() => {
    if (initialConfig?.atmosphere) {
      // Save to ConfigManager for runtime updates
      configManager.saveConfig(initialConfig.atmosphere);
      return initialConfig.atmosphere;
    }
    // Try to get from configManager (for runtime updates)
    const managerConfig = configManager.getConfig();
    if (managerConfig) {
      return managerConfig;
    }
    // If no config exists, load default from ConfigManager
    return configManager.loadConfig();
  }, [initialConfig?.atmosphere]);

  // Convert atmosphere config to MarketrixConfig
  const getMarketrixConfig = useCallback((): MarketrixConfig | null => {
    if (!atmosphereConfig) return null;

    return {
      ...initialConfig,
      atmosphere: atmosphereConfig,
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

  const getWidgetSettings = useCallback(() => {
    return atmosphereConfig?.widget_settings || DEFAULT_WIDGET_SETTINGS;
  }, [atmosphereConfig]);

  return {
    // State
    atmosphereConfig,

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

    // Getter methods (styling-related)
    getWidgetText,
    getWidgetCustomize,
    getWidgetPosition,
    getWidgetSettings,
  };
};

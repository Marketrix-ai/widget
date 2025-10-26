/**
 * Configuration transformation utilities
 * 
 * This file contains all transformation logic for converting between
 * different configuration formats. These are pure functions that can
 * be easily tested and reused.
 */

import type { IntegrationData, WidgetSettingsData } from '../sdk';
import type { WidgetAtmosphereConfig, MarketrixConfig } from '../types';
import {
  DEFAULT_WIDGET_ATMOSPHERE,
  DEFAULT_WIDGET_SETTINGS,
  DEFAULT_WIDGET_CUSTOMIZE,
  DEFAULT_AVATAR,
  DEFAULT_WIDGET_POSITION,
  DEFAULT_DEVICE_VISIBILITY,
  DEFAULT_LIVE_FORM,
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_THEMES,
  DEFAULT_RESPONSIVE_BREAKPOINTS,
  type WidgetPosition,
  type WidgetMode,
  type AvatarStatus,
  type StreamingAvatarStatus,
} from '../constants';

/**
 * Convert integration data to widget atmosphere configuration
 */
export function integrationToAtmosphere(integration: IntegrationData): WidgetAtmosphereConfig | null {
  if (!integration?.settings) {
    return null;
  }

  const settings = parseIntegrationSettings(integration.settings);
  if (!settings) {
    return null;
  }

  const position = normalizePosition(settings.widget_position);
  const mode = normalizeMode(settings.widget_appearance);

  return {
    ...DEFAULT_WIDGET_ATMOSPHERE,
    
    // Widget settings - direct mapping from integration settings
    widget_settings: {
      ...DEFAULT_WIDGET_SETTINGS,
      widget_enabled: settings.widget_enabled ?? true,
      widget_appearance: mode,
      widget_position: position,
      widget_device: settings.widget_device ?? 'desktop_mobile',
      widget_header: settings.widget_header ?? '🤖 AI Assistant',
      widget_body: settings.widget_body ?? "I'm here to help you with any questions or tasks.",
      widget_greeting: settings.widget_greeting ?? "🎉 Welcome! I'm your AI assistant!",
      widget_feature_tell: settings.widget_feature_tell ?? true,
      widget_feature_show: settings.widget_feature_show ?? true,
      widget_feature_do: settings.widget_feature_do ?? true,
      widget_feature_human: settings.widget_feature_human ?? true,
      widget_background_color: settings.widget_background_color ?? 'linear-gradient(135deg, #1BB55B45 0%, #987ADD45 100%)',
      widget_text_color: settings.widget_text_color ?? '#333333',
      widget_border_color: settings.widget_border_color ?? 'rgba(255, 255, 255, 0.3)',
      widget_accent_color: settings.widget_accent_color ?? '#1BB55B',
      widget_secondary_color: settings.widget_secondary_color ?? '#987ADD',
      widget_border_radius: settings.widget_border_radius ?? '12px',
      widget_font_size: settings.widget_font_size ?? '14px',
      widget_width: settings.widget_width ?? '360px',
      widget_height: settings.widget_height ?? '35rem',
      widget_shadow: settings.widget_shadow ?? '0 10px 25px rgba(0, 0, 0, 0.1)',
      widget_animation_duration: settings.widget_animation_duration ?? '300ms',
      widget_fade_duration: settings.widget_fade_duration ?? '200ms',
      widget_bounce_effect: settings.widget_bounce_effect ?? true,
      widget_chips: settings.widget_chips ?? DEFAULT_WIDGET_SETTINGS.widget_chips,
    },

    // Widget text - from integration settings
    widget_text: {
      greeting: settings.widget_greeting ?? 'Hello! How can I help you today?',
      placeholder: 'Show me...',
      header_ai: settings.widget_header ?? 'AI Assistant',
      header_live: 'Live Agent',
      body_ai: settings.widget_body ?? "I'm here to help you with any questions or tasks.",
      body_live: 'A live agent will be with you shortly.',
      chat_greeting: 'Welcome to our chat! How can I assist you?',
      tour_greeting: 'Welcome! Let me show you around.',
    },

    // Widget customization - from integration settings
    widget_customize: {
      colors: {
        primary: settings.widget_accent_color ?? '#1BB55B',
        secondary: settings.widget_secondary_color ?? '#987ADD',
        background: settings.widget_background_color ?? 'linear-gradient(135deg, #1BB55B26 0%, #987ADD30 100%)',
        text: settings.widget_text_color ?? '#333333',
        border: settings.widget_border_color ?? 'rgba(255, 255, 255, 0.2)',
      },
      sizes: {
        width: settings.widget_width ?? '320px',
        height: settings.widget_height ?? '35rem',
        border_radius: settings.widget_border_radius ?? '12px',
        font_size: settings.widget_font_size ?? '14px',
      },
      animations: {
        slide_duration: settings.widget_animation_duration ?? '300ms',
        fade_duration: settings.widget_fade_duration ?? '200ms',
        bounce_effect: settings.widget_bounce_effect ?? true,
      },
    },

    // Widget position - converted from API format
    widget_position: {
      position: position,
      offset: { x: 20, y: 20 },
      z_index: 40,
    },

    // Widget visibility - from integration settings
    widget_visible_device: {
      desktop: settings.widget_device === 'desktop' || settings.widget_device === 'desktop_mobile',
      tablet: settings.widget_device === 'desktop_mobile',
      mobile: settings.widget_device === 'mobile' || settings.widget_device === 'desktop_mobile',
    },

    // Live form - from integration settings
    mLive_form: {
      enabled: settings.widget_feature_human ?? true,
      fields: ['name', 'email', 'message'],
      required: ['name', 'email'],
    },

    // Advanced settings - from integration settings
    advanced_settings: {
      auto_open_delay: 0,
      session_timeout: 1800000, // 30 minutes
      max_messages: 100,
      typing_indicator: true,
      read_receipts: true,
      sound_notifications: true,
      vibration_enabled: true,
    },

    // Themes - from integration settings
    themes: {
      light: {
        background: '#ffffff',
        text: settings.widget_text_color ?? '#333333',
        border: '#e5e7eb',
        accent: settings.widget_accent_color ?? '#1BB55B',
      },
      dark: {
        background: '#1f2937',
        text: '#f9fafb',
        border: '#374151',
        accent: settings.widget_accent_color ?? '#10b981',
      },
    },

    // Responsive breakpoints - default values
    responsive_breakpoints: {
      mobile: '768px',
      tablet: '1024px',
      desktop: '1200px',
    },

    // Widget mode - from integration settings
    widget_mode: mode,
    widget_type: mode,
  };
}

/**
 * Convert widget atmosphere configuration to Marketrix config
 */
export function atmosphereToMarketrix(atmosphere: WidgetAtmosphereConfig): MarketrixConfig {
  return {
    marketrixId: atmosphere.inapp_login_id || 'default_id',
    marketrixKey: atmosphere.inapp_login_password || 'default_key',
    widgetSettings: atmosphere.widget_settings,
    atmosphere: atmosphere,
  };
}

/**
 * Merge configuration with defaults
 */
export function mergeWithDefaults<T extends Record<string, unknown>>(
  config: Partial<T>,
  defaults: T
): T {
  return { ...defaults, ...config };
}

/**
 * Validate widget settings structure
 */
export function validateWidgetSettings(settings: unknown): settings is WidgetSettingsData {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  const s = settings as Record<string, unknown>;
  
  // Check required fields
  const requiredFields = ['widget_enabled', 'widget_appearance', 'widget_position'];
  for (const field of requiredFields) {
    if (!(field in s)) {
      return false;
    }
  }

  return true;
}

/**
 * Parse integration settings from string or object
 */
function parseIntegrationSettings(settings: unknown): Record<string, unknown> | null {
  if (!settings) {
    return null;
  }

  if (typeof settings === 'string') {
    try {
      return JSON.parse(settings) as Record<string, unknown>;
    } catch (error) {
      console.error('Failed to parse settings JSON:', error);
      return null;
    }
  }

  if (typeof settings === 'object') {
    return settings as Record<string, unknown>;
  }

  return null;
}

/**
 * Normalize position format (convert from API format to internal format)
 */
function normalizePosition(position: unknown): WidgetPosition {
  if (typeof position === 'string') {
    // Convert from API format (bottom-right) to internal format (bottom_right)
    const normalized = position.replace('-', '_');
    if (['bottom_right', 'bottom_left', 'top_right', 'top_left'].includes(normalized)) {
      return normalized as WidgetPosition;
    }
  }
  return 'bottom_right';
}

/**
 * Normalize mode format
 */
function normalizeMode(mode: unknown): WidgetMode {
  if (typeof mode === 'string') {
    if (['ai', 'live', 'hybrid'].includes(mode)) {
      return mode as WidgetMode;
    }
  }
  return 'hybrid';
}

/**
 * Convert position from internal format to API format
 */
export function positionToApiFormat(position: WidgetPosition): string {
  return position.replace('_', '-');
}

/**
 * Convert position from API format to internal format
 */
export function positionFromApiFormat(position: string): WidgetPosition {
  return position.replace('-', '_') as WidgetPosition;
}

/**
 * Create default atmosphere config
 */
export function createDefaultAtmosphere(): WidgetAtmosphereConfig {
  return { ...DEFAULT_WIDGET_ATMOSPHERE };
}

/**
 * Create default widget settings
 */
export function createDefaultWidgetSettings(): WidgetSettingsData {
  return { ...DEFAULT_WIDGET_SETTINGS };
}

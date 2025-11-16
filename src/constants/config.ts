/**
 * Widget Configuration - Single Source of Truth
 *
 * This file contains all default widget settings, state, and atmosphere configuration.
 * All defaults are consolidated here to eliminate duplication across the codebase.
 */

// Re-export environment variables
export const VITE_API_URL = import.meta.env.VITE_API_URL || '';

import type { WidgetSettingsData } from '../sdk';
import type { WidgetAtmosphereConfig, WidgetPositionConfig } from '../types';

// ============================================================================
// DEFAULT WIDGET SETTINGS
// ============================================================================

/**
 * Default widget settings for marketrixId/marketrixKey path
 */
export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsData = {
  widget_enabled: true,
  widget_appearance: 'default',
  widget_position: 'bottom_right',
  widget_device: 'desktop_mobile',
  widget_header: '🤖 AI Assistant',
  widget_body: "I'm here to help you with any questions or tasks.",
  widget_greeting: "🎉 Welcome! I'm your AI assistant!",
  widget_feature_tell: true,
  widget_feature_show: true,
  widget_feature_do: true,
  widget_feature_human: true,
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
  widget_chips: [
    {
      chip_mode: 'tell',
      chip_text: 'Tell me about your services',
    },
    {
      chip_mode: 'show',
      chip_text: 'Show me pricing',
    },
    {
      chip_mode: 'do',
      chip_text: 'Schedule a demo',
    },
  ],
};

/**
 * Default fallback widget settings for connectionId/agentId path
 */
export const DEFAULT_FALLBACK_WIDGET_SETTINGS: WidgetSettingsData = {
  widget_enabled: true,
  widget_appearance: 'compact',
  widget_position: 'bottom_left',
  widget_device: 'desktop_mobile',
  widget_header: 'AI Assistant',
  widget_body: 'How can I help you today?',
  widget_greeting: 'Hello! How can I assist you?',
  widget_feature_tell: true,
  widget_feature_show: true,
  widget_feature_do: true,
  widget_feature_human: false,
  widget_background_color: 'linear-gradient(135deg, #1BB55B55 0%, #987ADD65 100%)',
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
  widget_chips: [],
};

// ============================================================================
// DEFAULT WIDGET POSITION (Local-only: offset/z_index)
// ============================================================================

/**
 * Default widget position configuration (local-only styling)
 * Position value comes from API (widget_settings.widget_position)
 */
export const DEFAULT_WIDGET_POSITION: Omit<WidgetPositionConfig, 'position'> = {
  offset: { x: 20, y: 20 },
  z_index: 40,
};

// ============================================================================
// DEFAULT WIDGET ATMOSPHERE CONFIG
// ============================================================================

/**
 * Complete default widget atmosphere configuration
 * Only includes API settings (widget_settings) and essential runtime state
 */
export const DEFAULT_WIDGET_ATMOSPHERE: WidgetAtmosphereConfig = {
  // Widget settings (from API or defaults)
  widget_settings: DEFAULT_WIDGET_SETTINGS,

  // Essential runtime state
  session_time: 0,
  sessionActive: true,
  recorded_time: 0,
  recordActive: false,
  widget_visible: true,
  widget_mode: 'ai',
  avatar_status: 'online',
  streaming_avatar_status: 'idle',

  // Local-only styling (offset/z_index only, position comes from API)
  widget_position: {
    position: DEFAULT_WIDGET_SETTINGS.widget_position,
    ...DEFAULT_WIDGET_POSITION,
  },
};

// ============================================================================
// HELPER GETTERS
// ============================================================================

/**
 * Get default widget configuration
 */
export function getDefaultWidgetConfig(): WidgetAtmosphereConfig {
  return { ...DEFAULT_WIDGET_ATMOSPHERE };
}

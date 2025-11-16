/**
 * Widget type definitions and constants
 *
 * This file contains type definitions, enums, and constant values.
 * All default values are in config.ts - this file re-exports them for backward compatibility.
 */

// Re-export all defaults from config.ts (now in same folder)
export {
  DEFAULT_FALLBACK_WIDGET_SETTINGS,
  DEFAULT_WIDGET_ATMOSPHERE,
  DEFAULT_WIDGET_POSITION,
  DEFAULT_WIDGET_SETTINGS,
  getDefaultFallbackSettings,
  getDefaultWidgetConfig,
  getDefaultWidgetSettings,
} from './config';

// Widget mode types
export const WIDGET_MODES = ['ai', 'live', 'hybrid'] as const;
export type WidgetMode = (typeof WIDGET_MODES)[number];

// Widget position constants (type is defined in types/index.ts)
export const WIDGET_POSITIONS = ['bottom_left', 'bottom_right'] as const;

// Widget appearance types
export const WIDGET_APPEARANCES = ['default', 'compact', 'full'] as const;
export type WidgetAppearance = (typeof WIDGET_APPEARANCES)[number];

// Widget device types
export const WIDGET_DEVICES = ['desktop', 'mobile', 'desktop_mobile'] as const;
export type WidgetDevice = (typeof WIDGET_DEVICES)[number];

// Avatar status types
export const AVATAR_STATUSES = ['online', 'offline', 'busy', 'away'] as const;
export type AvatarStatus = (typeof AVATAR_STATUSES)[number];

// Streaming avatar status types
export const STREAMING_AVATAR_STATUSES = ['idle', 'typing', 'speaking', 'listening'] as const;
export type StreamingAvatarStatus = (typeof STREAMING_AVATAR_STATUSES)[number];

// Chat mode constants (type is defined in types/index.ts)
export const CHAT_MODES = ['show', 'tell', 'do'] as const;

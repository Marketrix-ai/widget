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

// Widget mode type (only type is used, not the constant array)
export type WidgetMode = 'ai' | 'live' | 'hybrid';

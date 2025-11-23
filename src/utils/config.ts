/**
 * Configuration Getters
 *
 * Utilities for extracting and formatting configuration values from MarketrixConfig.
 * These functions provide a clean interface for accessing widget configuration.
 */

import { DEFAULT_MARKETRIX_CONFIG, extractWidgetSettingsFromConfig } from '../constants/config';
import type { MarketrixConfig } from '../types';

export interface WidgetTextConfig {
  greeting: string;
  placeholder: string;
  header_ai: string;
  header_live: string;
  body_ai: string;
  body_live: string;
  chat_greeting: string;
  tour_greeting: string;
}

export interface WidgetCustomizeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    border: string;
  };
  sizes: {
    width: string;
    height: string;
    border_radius: string;
    font_size: string;
  };
  animations: {
    slide_duration: string;
    fade_duration: string;
    bounce_effect: boolean;
  };
}

export interface WidgetPositionConfig {
  position: string;
  offset: { x: number; y: number };
  z_index: number;
}

/**
 * Get widget text configuration from MarketrixConfig
 */
export function getWidgetText(config: MarketrixConfig): WidgetTextConfig {
  const settings = extractWidgetSettingsFromConfig(config);
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
}

/**
 * Get widget customization configuration from MarketrixConfig
 */
export function getWidgetCustomize(config: MarketrixConfig): WidgetCustomizeConfig {
  const settings = extractWidgetSettingsFromConfig(config);
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
}

/**
 * Get widget position configuration from MarketrixConfig
 */
export function getWidgetPosition(config: MarketrixConfig): WidgetPositionConfig {
  const settings = extractWidgetSettingsFromConfig(config);
  const defaultOffset = { x: 20, y: 20 };
  const offset = config.widget_position_offset ?? DEFAULT_MARKETRIX_CONFIG.widget_position_offset;

  return {
    position: settings.widget_position,
    offset: {
      x: offset?.x ?? defaultOffset.x,
      y: offset?.y ?? defaultOffset.y,
    },
    z_index:
      config.widget_position_z_index ?? DEFAULT_MARKETRIX_CONFIG.widget_position_z_index ?? 40,
  };
}

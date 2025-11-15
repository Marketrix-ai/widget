/**
 * Configuration transformation utilities
 *
 * This file contains all transformation logic for converting between
 * different configuration formats. These are pure functions that can
 * be easily tested and reused.
 */

import {
  DEFAULT_WIDGET_ATMOSPHERE,
  DEFAULT_WIDGET_POSITION,
  getDefaultWidgetSettings,
} from '../config';
import type { WidgetMode, WidgetPosition } from '../constants/widget';
import type { IntegrationData, WidgetSettingsData } from '../sdk';
import type { MarketrixConfig, WidgetAtmosphereConfig } from '../types';
import { hasProperty, isWidgetMode, isWidgetPosition } from './typeGuards';

/**
 * Merge widget settings with defaults, reducing repetition
 */
function mergeWidgetSettingsWithDefaults(
  settings: Partial<WidgetSettingsData>
): WidgetSettingsData {
  const defaults = getDefaultWidgetSettings();
  return {
    ...defaults,
    ...settings,
    widget_chips: settings.widget_chips ?? [...defaults.widget_chips],
  };
}

/**
 * Convert integration data to widget atmosphere configuration
 */
export function integrationToAtmosphere(
  integration: IntegrationData
): WidgetAtmosphereConfig | null {
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

    // Widget settings - merge with defaults
    widget_settings: mergeWidgetSettingsWithDefaults({
      ...settings,
      widget_position: position,
    }),

    // Widget position - position from API, offset/z_index from local defaults
    widget_position: {
      position,
      offset: DEFAULT_WIDGET_POSITION.offset,
      z_index: DEFAULT_WIDGET_POSITION.z_index,
    },

    // Widget mode - from integration settings
    widget_mode: mode,
  };
}

/**
 * Convert widget atmosphere configuration to Marketrix config
 */
export function atmosphereToMarketrix(atmosphere: WidgetAtmosphereConfig): MarketrixConfig {
  return {
    atmosphere,
  };
}

/**
 * Validate widget settings structure
 */
export function validateWidgetSettings(settings: unknown): settings is WidgetSettingsData {
  if (!settings || typeof settings !== 'object') {
    return false;
  }

  // Check required fields
  const requiredFields = ['widget_enabled', 'widget_appearance', 'widget_position'] as const;
  for (const field of requiredFields) {
    if (!hasProperty(settings, field)) {
      return false;
    }
  }

  return true;
}

/**
 * Parse integration settings from string or object
 */
function parseIntegrationSettings(settings: unknown): WidgetSettingsData | null {
  if (!settings) {
    return null;
  }

  if (typeof settings === 'string') {
    try {
      const parsed: unknown = JSON.parse(settings);
      // Validate that it has the required widget settings structure
      if (validateWidgetSettings(parsed)) {
        return parsed;
      }
      return null;
    } catch (error) {
      console.error('Failed to parse settings JSON:', error);
      return null;
    }
  }

  if (validateWidgetSettings(settings)) {
    return settings;
  }

  return null;
}

/**
 * Normalize position format (convert from API format to internal format)
 */
function normalizePosition(position: unknown): WidgetPosition {
  if (isWidgetPosition(position)) {
    return position;
  }
  return 'bottom_right';
}

/**
 * Normalize mode format
 */
function normalizeMode(mode: unknown): WidgetMode {
  if (isWidgetMode(mode)) {
    return mode;
  }
  return 'hybrid';
}

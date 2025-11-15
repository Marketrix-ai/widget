/**
 * Configuration Helpers
 *
 * Consolidates common configuration merging patterns to follow DRY principle.
 * Eliminates repetition of DEFAULT_WIDGET_ATMOSPHERE spreading and config merging.
 */

import { DEFAULT_FALLBACK_WIDGET_SETTINGS, DEFAULT_WIDGET_ATMOSPHERE } from '../config';
import type { MarketrixConfig, WidgetAtmosphereConfig } from '../types';

/**
 * Merge config with default atmosphere
 * Consolidates the repeated pattern of spreading DEFAULT_WIDGET_ATMOSPHERE
 */
export function mergeConfigWithDefaultAtmosphere(
  config: MarketrixConfig,
  useFallbackSettings = false
): MarketrixConfig {
  return {
    ...config,
    atmosphere: {
      ...DEFAULT_WIDGET_ATMOSPHERE,
      ...config.atmosphere,
      widget_settings: useFallbackSettings
        ? DEFAULT_FALLBACK_WIDGET_SETTINGS
        : (config.atmosphere?.widget_settings ?? DEFAULT_FALLBACK_WIDGET_SETTINGS),
      session_time: config.atmosphere?.session_time ?? 0,
      recorded_time: config.atmosphere?.recorded_time ?? 0,
    },
  };
}

/**
 * Create default atmosphere config for connectionId/agentId path
 * Consolidates the repeated pattern in index.tsx
 */
export function createDefaultAtmosphereConfig(config: MarketrixConfig): WidgetAtmosphereConfig {
  return {
    ...DEFAULT_WIDGET_ATMOSPHERE,
    ...config.atmosphere,
    widget_settings: DEFAULT_FALLBACK_WIDGET_SETTINGS,
    session_time: config.atmosphere?.session_time ?? 0,
    recorded_time: config.atmosphere?.recorded_time ?? 0,
  };
}

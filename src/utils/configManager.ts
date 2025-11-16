import {
  DEFAULT_FALLBACK_WIDGET_SETTINGS,
  DEFAULT_WIDGET_ATMOSPHERE,
  getDefaultWidgetConfig,
} from '../constants/config';
import type { MarketrixConfig, WidgetAtmosphereConfig } from '../types';
import { hasProperty } from './typeGuards';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: WidgetAtmosphereConfig | null = null;

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  loadConfig(): WidgetAtmosphereConfig {
    try {
      const stored = localStorage.getItem('marketrix_widget_config');
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (this.validateConfig(parsed)) {
          this.config = parsed;
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error);
    }

    this.config = this.getDefaultConfig();
    return this.config;
  }

  saveConfig(config: WidgetAtmosphereConfig): void {
    try {
      localStorage.setItem('marketrix_widget_config', JSON.stringify(config));
      this.config = config;
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }

  updateConfig(updates: Partial<WidgetAtmosphereConfig>): void {
    if (!this.config) {
      this.config = this.getDefaultConfig();
    }

    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  getConfig(): WidgetAtmosphereConfig | null {
    return this.config;
  }

  private validateConfig(config: unknown): config is WidgetAtmosphereConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const requiredFields = ['widget_settings', 'widget_visible', 'widget_mode'] as const;
    for (const field of requiredFields) {
      if (!hasProperty(config, field)) {
        return false;
      }
    }

    return true;
  }

  shouldShowWidget(): boolean {
    if (!this.config) {
      return false;
    }

    return this.config.widget_visible && this.config.widget_settings.widget_enabled;
  }

  private getDefaultConfig(): WidgetAtmosphereConfig {
    return getDefaultWidgetConfig();
  }
}

export const configManager = ConfigManager.getInstance();

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

import type { WidgetSettingsData } from '../sdk';
import type { MarketrixConfig } from '../types';
import { hasProperty } from '../utils/validation';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: MarketrixConfig | null = null;

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  loadConfig(): MarketrixConfig {
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

    // Return empty config - defaults should come from API
    this.config = {};
    return this.config;
  }

  saveConfig(config: MarketrixConfig): void {
    try {
      localStorage.setItem('marketrix_widget_config', JSON.stringify(config));
      this.config = config;
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }

  updateConfig(updates: Partial<MarketrixConfig>): void {
    if (!this.config) {
      this.config = {};
    }

    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  getConfig(): MarketrixConfig | null {
    return this.config;
  }

  private validateConfig(config: unknown): config is MarketrixConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }
    return hasProperty(config, 'widget_enabled');
  }

  shouldShowWidget(): boolean {
    if (!this.config) {
      return false;
    }
    return this.config.widget_enabled ?? false;
  }
}

export const configManager = ConfigManager.getInstance();

/**
 * Creates MarketrixConfig from WidgetSettingsData
 * Since MarketrixConfig extends WidgetSettingsData, this is just a direct merge.
 * API settings (which include defaults) override base config.
 */
export function createConfigFromSettings(
  widgetSettings: WidgetSettingsData,
  baseConfig: Partial<MarketrixConfig> = {}
): MarketrixConfig {
  // Direct merge - MarketrixConfig already extends WidgetSettingsData
  return {
    ...baseConfig,
    ...widgetSettings,
  } as MarketrixConfig;
}

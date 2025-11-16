import { DEFAULT_MARKETRIX_CONFIG } from '../constants/config';
import type { WidgetSettingsData } from '../sdk';
import type { MarketrixConfig } from '../types';
import { hasProperty } from './typeGuards';

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

    this.config = this.getDefaultConfig();
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
      this.config = this.getDefaultConfig();
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

  private getDefaultConfig(): MarketrixConfig {
    return { ...DEFAULT_MARKETRIX_CONFIG };
  }
}

export const configManager = ConfigManager.getInstance();

export function createConfigFromSettings(
  widgetSettings: WidgetSettingsData,
  baseConfig: Partial<MarketrixConfig> = {}
): MarketrixConfig {
  return {
    ...DEFAULT_MARKETRIX_CONFIG,
    ...baseConfig,
    ...widgetSettings, // API settings override defaults and base config
  };
}

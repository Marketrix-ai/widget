import type { WidgetSettingsData } from '../sdk';
import type { MarketrixConfig } from '../types';
import { storageService } from './StorageService';

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
    const stored = storageService.getConfig();
    if (stored) {
      this.config = stored;
      return stored;
    }

    this.config = {};
    return this.config;
  }

  saveConfig(config: MarketrixConfig): void {
    storageService.setConfig(config);
    this.config = config;
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

  shouldShowWidget(): boolean {
    if (!this.config) {
      return false;
    }
    return this.config.widget_enabled ?? false;
  }
}

export const configManager = ConfigManager.getInstance();

export function createConfigFromSettings(
  widgetSettings: WidgetSettingsData,
  baseConfig: Partial<MarketrixConfig> = {},
): MarketrixConfig {
  return {
    ...baseConfig,
    ...widgetSettings,
  } as MarketrixConfig;
}

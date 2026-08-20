import type { WidgetSettingsData } from '../sdk';
import type { MarketrixConfig } from '../types';
import { storageService } from './StorageService';

export class ConfigManager {
  private config: MarketrixConfig | null = null;

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

  getConfig(): MarketrixConfig | null {
    return this.config;
  }
}

export const configManager = new ConfigManager();

export function createConfigFromSettings(
  widgetSettings: WidgetSettingsData,
  baseConfig: Partial<MarketrixConfig> = {},
): MarketrixConfig {
  return {
    ...baseConfig,
    ...widgetSettings,
  } as MarketrixConfig;
}

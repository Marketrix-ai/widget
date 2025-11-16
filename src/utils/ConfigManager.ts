import {
  DEFAULT_FALLBACK_WIDGET_SETTINGS,
  DEFAULT_WIDGET_ATMOSPHERE,
  DEFAULT_WIDGET_POSITION,
  getDefaultWidgetConfig,
} from '../constants/config';
import type { MarketrixConfig, WidgetAtmosphereConfig } from '../types';
import { hasProperty } from './typeGuards';
type Timer = ReturnType<typeof setTimeout>;

export class ConfigManager {
  private static instance: ConfigManager;
  private config: WidgetAtmosphereConfig | null = null;
  private listeners: Array<(config: WidgetAtmosphereConfig) => void> = [];
  private autoRefreshInterval: Timer | null = null;

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
      this.notifyListeners();
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

  toMarketrixConfig(config: WidgetAtmosphereConfig): MarketrixConfig {
    return {
      atmosphere: config,
    };
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

  addListener(listener: (config: WidgetAtmosphereConfig) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (config: WidgetAtmosphereConfig) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  subscribe(listener: (config: WidgetAtmosphereConfig) => void): void {
    this.addListener(listener);
  }

  private notifyListeners(): void {
    const config = this.config;
    if (config) {
      this.listeners.forEach((listener) => listener(config));
    }
  }

  startAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      return;
    }

    this.autoRefreshInterval = setInterval(() => {
      this.loadConfig();
    }, 5000);
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  shouldShowWidget(): boolean {
    if (!this.config) {
      return false;
    }

    return this.config.widget_visible && this.config.widget_settings.widget_enabled;
  }

  updateWidgetPosition(position: 'bottom_left' | 'bottom_right'): void {
    this.updateConfig({
      widget_position: {
        position,
        offset: DEFAULT_WIDGET_POSITION.offset,
        z_index: DEFAULT_WIDGET_POSITION.z_index,
      },
    });
  }

  updateWidgetVisibility(visible: boolean): void {
    this.updateConfig({ widget_visible: visible });
  }

  updateWidgetMode(mode: 'ai' | 'live' | 'hybrid'): void {
    this.updateConfig({ widget_mode: mode });
  }

  updateAvatarStatus(status: 'online' | 'offline' | 'busy'): void {
    this.updateConfig({ avatar_status: status });
  }

  updateStreamingAvatarStatus(status: 'idle' | 'typing' | 'speaking' | 'listening'): void {
    this.updateConfig({ streaming_avatar_status: status });
  }

  updateSessionTime(time: number): void {
    this.updateConfig({ session_time: time });
  }

  updateRecordedTime(time: number): void {
    this.updateConfig({ recorded_time: time });
  }

  toggleRecording(): void {
    if (this.config) {
      this.updateConfig({ recordActive: !this.config.recordActive });
    }
  }

  toggleSession(): void {
    if (this.config) {
      this.updateConfig({ sessionActive: !this.config.sessionActive });
    }
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

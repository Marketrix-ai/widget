import { WidgetSettingsDataSchema } from '../sdk/schema';
import type { MarketrixConfig, WidgetAtmosphereConfig } from '../types';
import { DEFAULT_WIDGET_ATMOSPHERE, DEFAULT_WIDGET_SETTINGS } from '../constants';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: WidgetAtmosphereConfig | null = null;
  private listeners: Array<(config: WidgetAtmosphereConfig) => void> = [];
  private autoRefreshInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from localStorage or use defaults
   */
  loadConfig(): WidgetAtmosphereConfig {
    try {
      const stored = localStorage.getItem('marketrix_widget_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.validateConfig(parsed)) {
          this.config = parsed;
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error);
    }

    // Use default config if loading fails
    this.config = this.getDefaultConfig();
    return this.config;
  }

  /**
   * Save configuration to localStorage
   */
  saveConfig(config: WidgetAtmosphereConfig): void {
    try {
      localStorage.setItem('marketrix_widget_config', JSON.stringify(config));
      this.config = config;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<WidgetAtmosphereConfig>): void {
    if (!this.config) {
      this.config = this.getDefaultConfig();
    }

    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): WidgetAtmosphereConfig | null {
    return this.config;
  }

  /**
   * Convert MarketrixConfig to WidgetAtmosphereConfig
   */
  toMarketrixConfig(config: WidgetAtmosphereConfig): MarketrixConfig {
    return {
      marketrixId: config.inapp_login_id || 'default_id',
      marketrixKey: config.inapp_login_password || 'default_key',
      widgetSettings: config.widget_settings,
      atmosphere: config,
    };
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: unknown): config is WidgetAtmosphereConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const c = config as Record<string, unknown>;
    
    // Check required fields
    const requiredFields = ['widget_settings', 'widget_type', 'widget_visible'];
    for (const field of requiredFields) {
      if (!(field in c)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Add configuration change listener
   */
  addListener(listener: (config: WidgetAtmosphereConfig) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove configuration change listener
   */
  removeListener(listener: (config: WidgetAtmosphereConfig) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Subscribe to configuration changes (alias for addListener)
   */
  subscribe(listener: (config: WidgetAtmosphereConfig) => void): void {
    this.addListener(listener);
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    if (this.config) {
      this.listeners.forEach((listener) => listener(this.config!));
    }
  }

  /**
   * Start auto-refresh of configuration
   */
  startAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      return;
    }

    this.autoRefreshInterval = setInterval(() => {
      this.loadConfig();
    }, 5000); // Refresh every 5 seconds
  }

  /**
   * Stop auto-refresh of configuration
   */
  stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  /**
   * Check if widget should be shown
   */
  shouldShowWidget(): boolean {
    if (!this.config) {
      return false;
    }

    return this.config.widget_visible && this.config.widget_settings.widget_enabled;
  }

  /**
   * Get default widget settings
   */
  private getDefaultWidgetSettings() {
    return { ...DEFAULT_WIDGET_SETTINGS };
  }

  /**
   * Update widget position
   */
  updateWidgetPosition(position: string): void {
    this.updateConfig({ widget_position: { position: position as any, offset: { x: 20, y: 20 }, z_index: 40 } });
  }

  /**
   * Update widget visibility
   */
  updateWidgetVisibility(visible: boolean): void {
    this.updateConfig({ widget_visible: visible });
  }

  /**
   * Update widget mode
   */
  updateWidgetMode(mode: string): void {
    this.updateConfig({ widget_mode: mode as any, widget_type: mode as any });
  }

  /**
   * Update avatar status
   */
  updateAvatarStatus(status: string): void {
    this.updateConfig({ avatar_status: status as any });
  }

  /**
   * Update streaming avatar status
   */
  updateStreamingAvatarStatus(status: string): void {
    this.updateConfig({ streaming_avatar_status: status as any });
  }

  /**
   * Update session time
   */
  updateSessionTime(time: number): void {
    this.updateConfig({ session_time: time });
  }

  /**
   * Update recorded time
   */
  updateRecordedTime(time: number): void {
    this.updateConfig({ recorded_time: time });
  }

  /**
   * Toggle recording
   */
  toggleRecording(): void {
    if (this.config) {
      this.updateConfig({ recordActive: !this.config.recordActive });
    }
  }

  /**
   * Toggle session
   */
  toggleSession(): void {
    if (this.config) {
      this.updateConfig({ sessionActive: !this.config.sessionActive });
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): WidgetAtmosphereConfig {
    return { ...DEFAULT_WIDGET_ATMOSPHERE };
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();
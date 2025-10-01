import { WidgetAtmosphereConfig, MarketrixConfig } from '../types';
import { WidgetSettingsDataSchema } from '../sdk/schema';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: WidgetAtmosphereConfig | null = null;
  private listeners: Array<(config: WidgetAtmosphereConfig) => void> = [];
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from JSON file
   */
  public async loadConfig(configPath: string = './src/config/widget-atmosphere.json'): Promise<WidgetAtmosphereConfig> {
    try {
      const response = await fetch(configPath);
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.statusText}`);
      }
      const configData = await response.json();
      
      // Validate widget_settings if present
      if (configData.widget_settings) {
        const validationResult = WidgetSettingsDataSchema.safeParse(configData.widget_settings);
        if (!validationResult.success) {
          console.warn('Widget settings validation failed:', validationResult.error);
          // Use default widget settings if validation fails
          configData.widget_settings = this.getDefaultWidgetSettings();
        }
      } else {
        // Add default widget settings if not present
        configData.widget_settings = this.getDefaultWidgetSettings();
      }
      
      this.config = configData;
      this.notifyListeners();
      return this.config!;
    } catch (error) {
      console.error('Error loading widget atmosphere config:', error);
      // Return default config if loading fails
      return this.getDefaultConfig();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): WidgetAtmosphereConfig | null {
    return this.config;
  }

  /**
   * Update configuration and notify listeners
   */
  public updateConfig(newConfig: Partial<WidgetAtmosphereConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...newConfig };
      this.notifyListeners();
    }
  }

  /**
   * Convert atmosphere config to MarketrixConfig
   */
  public toMarketrixConfig(atmosphereConfig: WidgetAtmosphereConfig): MarketrixConfig {
    return {
      marketrixId: 'default-id', // This should be provided separately
      marketrixKey: 'default-key', // This should be provided separately
      position: atmosphereConfig.widget_position?.position || 'bottom-right',
      theme: 'light', // Can be determined from atmosphere config
      avatarUrl: atmosphereConfig.active_avatar?.url,
      agentName: atmosphereConfig.active_avatar?.name,
      enabledModes: ['show', 'tell', 'do'],
      
      // Map atmosphere config to MarketrixConfig
      session_time: atmosphereConfig.session_time,
      sessionActive: atmosphereConfig.sessionActive,
      recorded_time: atmosphereConfig.recorded_time,
      recordActive: atmosphereConfig.recordActive,
      widget_text: atmosphereConfig.widget_text,
      widget_type: atmosphereConfig.widget_type,
      widget_visible: atmosphereConfig.widget_visible,
      widget_customize: atmosphereConfig.widget_customize,
      active_avatar: atmosphereConfig.active_avatar,
      avatar_trigger_time: atmosphereConfig.avatar_trigger_time,
      enable_widget_popup: atmosphereConfig.enable_widget_popup,
      avatar_status: atmosphereConfig.avatar_status,
      widget_mode: atmosphereConfig.widget_mode,
      mLive_form: atmosphereConfig.mLive_form,
      hybrid_agents_on: atmosphereConfig.hybrid_agents_on,
      hybrid_agents_off: atmosphereConfig.hybrid_agents_off,
      widget_visible_device: atmosphereConfig.widget_visible_device,
      streaming_avatar_status: atmosphereConfig.streaming_avatar_status,
      widget_position: atmosphereConfig.widget_position,
      enable_ai_tour: atmosphereConfig.enable_ai_tour,
      widget_header_ai: atmosphereConfig.widget_header_ai,
      widget_body_ai: atmosphereConfig.widget_body_ai,
      widget_header_live: atmosphereConfig.widget_header_live,
      widget_body_live: atmosphereConfig.widget_body_live,
      widget_chat_greeting: atmosphereConfig.widget_chat_greeting,
      widget_tour_greeting: atmosphereConfig.widget_tour_greeting,
      inapp_login_url: atmosphereConfig.inapp_login_url,
      inapp_login_id: atmosphereConfig.inapp_login_id,
      inapp_login_password: atmosphereConfig.inapp_login_password,
      advanced_settings: atmosphereConfig.advanced_settings,
      themes: atmosphereConfig.themes,
      responsive_breakpoints: atmosphereConfig.responsive_breakpoints,
    };
  }

  /**
   * Subscribe to configuration changes
   */
  public subscribe(listener: (config: WidgetAtmosphereConfig) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Start auto-refreshing configuration from file
   */
  public startAutoRefresh(intervalMs: number = 5000): void {
    this.stopAutoRefresh();
    this.updateInterval = setInterval(async () => {
      try {
        await this.loadConfig();
      } catch (error) {
        console.warn('Auto-refresh config failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop auto-refreshing configuration
   */
  public stopAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update specific widget properties
   */
  public updateWidgetProperty<K extends keyof WidgetAtmosphereConfig>(
    key: K,
    value: WidgetAtmosphereConfig[K]
  ): void {
    if (this.config) {
      this.config[key] = value;
      this.notifyListeners();
    }
  }

  /**
   * Update widget position
   */
  public updateWidgetPosition(position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'): void {
    if (this.config?.widget_position) {
      this.config.widget_position.position = position;
      this.notifyListeners();
    }
  }

  /**
   * Update widget visibility
   */
  public updateWidgetVisibility(visible: boolean): void {
    this.updateWidgetProperty('widget_visible', visible);
  }

  /**
   * Update widget mode
   */
  public updateWidgetMode(mode: 'ai' | 'live' | 'hybrid'): void {
    this.updateWidgetProperty('widget_mode', mode);
  }

  /**
   * Update avatar status
   */
  public updateAvatarStatus(status: 'online' | 'offline' | 'busy' | 'away'): void {
    this.updateWidgetProperty('avatar_status', status);
  }

  /**
   * Update streaming avatar status
   */
  public updateStreamingAvatarStatus(status: 'idle' | 'typing' | 'speaking' | 'listening'): void {
    this.updateWidgetProperty('streaming_avatar_status', status);
  }

  /**
   * Update session time
   */
  public updateSessionTime(time: number): void {
    this.updateWidgetProperty('session_time', time);
  }

  /**
   * Update recorded time
   */
  public updateRecordedTime(time: number): void {
    this.updateWidgetProperty('recorded_time', time);
  }

  /**
   * Toggle recording
   */
  public toggleRecording(): void {
    if (this.config) {
      this.config.recordActive = !this.config.recordActive;
      this.notifyListeners();
    }
  }

  /**
   * Toggle session
   */
  public toggleSession(): void {
    if (this.config) {
      this.config.sessionActive = !this.config.sessionActive;
      this.notifyListeners();
    }
  }

  /**
   * Get device-specific visibility
   */
  public isVisibleOnDevice(deviceType: 'desktop' | 'tablet' | 'mobile'): boolean {
    if (!this.config?.widget_visible_device) return true;
    return this.config.widget_visible_device[deviceType] ?? true;
  }

  /**
   * Check if widget should be visible based on device
   */
  public shouldShowWidget(): boolean {
    if (!this.config?.widget_visible) return false;
    
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    const isDesktop = window.innerWidth >= 1024;
    
    if (isMobile) return this.isVisibleOnDevice('mobile');
    if (isTablet) return this.isVisibleOnDevice('tablet');
    if (isDesktop) return this.isVisibleOnDevice('desktop');
    
    return true;
  }

  private notifyListeners(): void {
    if (this.config) {
      this.listeners.forEach(listener => listener(this.config!));
    }
  }

  private getDefaultWidgetSettings() {
    return {
      widget_enabled: true,
      widget_appearance: 'default' as const,
      widget_position: 'bottom-right' as const,
      widget_device: 'desktop_mobile' as const,
      widget_header: '🤖 AI Assistant',
      widget_body: 'I\'m here to help you with any questions or tasks.',
      widget_greeting: '🎉 Welcome! I\'m your AI assistant!',
      widget_feature_tell: true,
      widget_feature_show: true,
      widget_feature_do: true,
      widget_feature_request_human: true,
      widget_background_color: 'linear-gradient(135deg, #1BB55B45 0%, #987ADD45 100%)',
      widget_text_color: '#333333',
      widget_border_color: 'rgba(255, 255, 255, 0.3)',
      widget_accent_color: '#1BB55B',
      widget_secondary_color: '#987ADD',
      widget_border_radius: '12px',
      widget_font_size: '14px',
      widget_width: '360px',
      widget_height: '35rem',
      widget_shadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      widget_animation_duration: '300ms',
      widget_fade_duration: '200ms',
      widget_bounce_effect: true,
      widget_z_index: 40,
      widget_chips: [
        {
          chip_mode: 'tell' as const,
          chip_text: 'Tell me about your services'
        },
        {
          chip_mode: 'show' as const,
          chip_text: 'Show me pricing'
        },
        {
          chip_mode: 'do' as const,
          chip_text: 'Schedule a demo'
        }
      ]
    };
  }

  private getDefaultConfig(): WidgetAtmosphereConfig {
    return {
      session_time: 0,
      sessionActive: true,
      recorded_time: 0,
      recordActive: false,
      widget_text: {
        greeting: "Hello! How can I help you today?",
        placeholder: "Show me...",
        header_ai: "AI Assistant",
        header_live: "Live Agent",
        body_ai: "I'm here to help you with any questions or tasks.",
        body_live: "A live agent will be with you shortly.",
        chat_greeting: "Welcome to our chat! How can I assist you?",
        tour_greeting: "Welcome! Let me show you around."
      },
      widget_settings: this.getDefaultWidgetSettings(),
      widget_type: "hybrid",
      widget_visible: true,
      widget_customize: {
        colors: {
          primary: "#1BB55B",
          secondary: "#987ADD",
          background: "linear-gradient(135deg, #1BB55B26 0%, #987ADD30 100%)",
          text: "#333333",
          border: "rgba(255, 255, 255, 0.2)"
        },
        sizes: {
          width: "320px",
          height: "35rem",
          border_radius: "12px",
          font_size: "14px"
        },
        animations: {
          slide_duration: "300ms",
          fade_duration: "200ms",
          bounce_effect: true
        }
      },
      active_avatar: {
        url: "https://example.com/avatar.png",
        name: "Marketrix Assistant",
        status: "online"
      },
      avatar_trigger_time: 5000,
      enable_widget_popup: true,
      avatar_status: "online",
      widget_mode: "ai",
      mLive_form: {
        enabled: true,
        fields: ["name", "email", "message"],
        required: ["name", "email"]
      },
      hybrid_agents_on: true,
      hybrid_agents_off: false,
      widget_visible_device: {
        desktop: true,
        tablet: true,
        mobile: true
      },
      streaming_avatar_status: "idle",
      widget_position: {
        position: "bottom-right",
        offset: { x: 20, y: 20 },
        z_index: 40
      },
      enable_ai_tour: true,
      widget_header_ai: "AI Assistant",
      widget_body_ai: "I'm here to help you with any questions or tasks.",
      widget_header_live: "Live Agent",
      widget_body_live: "A live agent will be with you shortly.",
      widget_chat_greeting: "Welcome to our chat! How can I assist you?",
      widget_tour_greeting: "Welcome! Let me show you around.",
      inapp_login_url: "https://app.marketrix.com/login",
      inapp_login_id: "user123",
      inapp_login_password: "encrypted_password_hash",
      advanced_settings: {
        auto_open_delay: 0,
        session_timeout: 1800000,
        max_messages: 100,
        typing_indicator: true,
        read_receipts: true,
        sound_notifications: true,
        vibration_enabled: true
      },
      themes: {
        light: {
          background: "#ffffff",
          text: "#333333",
          border: "#e5e7eb",
          accent: "#1BB55B"
        },
        dark: {
          background: "#1f2937",
          text: "#f9fafb",
          border: "#374151",
          accent: "#10b981"
        }
      },
      responsive_breakpoints: {
        mobile: "768px",
        tablet: "1024px",
        desktop: "1200px"
      }
    };
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();

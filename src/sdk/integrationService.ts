import { IntegrationData } from './schema';

export interface IntegrationSettings {
  widget_enabled?: boolean;
  widget_appearance?: string;
  widget_position?: string;
  widget_device?: string;
  widget_header?: string;
  widget_body?: string;
  widget_greeting?: string;
  widget_feature_tell?: boolean;
  widget_feature_show?: boolean;
  widget_feature_do?: boolean;
  widget_feature_request_human?: boolean;
  widget_background_color?: string;
  widget_text_color?: string;
  widget_border_color?: string;
  widget_accent_color?: string;
  widget_secondary_color?: string;
  widget_border_radius?: string;
  widget_font_size?: string;
  widget_width?: string;
  widget_height?: string;
  widget_shadow?: string;
  widget_animation_duration?: string;
  widget_fade_duration?: string;
  widget_bounce_effect?: boolean;
  widget_chips?: Array<{
    chip_mode?: string;
    chip_text?: string;
    type?: string;
    question?: string;
  }>;
}

export class IntegrationService {
  private marketrixId: string;
  private marketrixKey: string;

  constructor(marketrixId: string, marketrixKey: string) {
    this.marketrixId = marketrixId;
    this.marketrixKey = marketrixKey;
  }

  /**
   * Fetch integration settings from the API using integrationSearch endpoint
   */
  async fetchIntegrationSettings(): Promise<IntegrationData | null> {
    try {
      console.log('Fetching integration settings via direct fetch:', { 
        marketrixId: this.marketrixId, 
        marketrixKey: this.marketrixKey 
      });

      // Use direct fetch to avoid circular import issues
      const response = await fetch(`http://localhost:8080/integration?marketrix_id=${this.marketrixId}&marketrix_key=${this.marketrixKey}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const integrations = data.data as IntegrationData[];
        
        // Find the widget integration from the search results
        const widgetIntegration = integrations.find((integration: IntegrationData) => 
          integration.type === 'widget' && 
          integration.status === 'active'
        );

        if (widgetIntegration) {
          console.log('Found widget integration via direct fetch:', widgetIntegration);
          return widgetIntegration;
        }
      }

      console.warn('No widget integration found for the provided credentials');
      return null;
    } catch (error) {
      console.error('Failed to fetch integration settings via direct fetch:', error);
      return null;
    }
  }

  /**
   * Get widget settings from integration data
   */
  getWidgetSettings(integration: IntegrationData): IntegrationSettings | null {
    if (!integration.settings) {
      return null;
    }

    // Parse settings if they're stored as a JSON string
    let settings = integration.settings;
    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch (error) {
        console.error('Failed to parse settings JSON:', error);
        return null;
      }
    }

    // Type guard to check if this is widget settings
    if (!settings || typeof settings !== 'object' || !('widget_enabled' in settings)) {
      console.warn('Settings are not widget settings');
      return null;
    }

    return settings as IntegrationSettings;
  }

  /**
   * Convert integration settings to widget atmosphere configuration
   */
  convertToAtmosphereConfig(integration: IntegrationData): any {
    const settings = this.getWidgetSettings(integration);
    if (!settings) {
      return {};
    }

    console.log('Converting integration settings to atmosphere config:', settings);

    // Convert position from API format (bottom_right) to CSS format (bottom-right)
    const position = settings.widget_position?.replace('_', '-') ?? 'bottom-right';

    return {
      // Widget settings - direct mapping from integration settings
      widget_settings: {
        widget_enabled: settings.widget_enabled ?? true,
        widget_appearance: settings.widget_appearance ?? 'default',
        widget_position: position as 'bottom-left' | 'bottom-right',
        widget_device: settings.widget_device ?? 'desktop_mobile',
        widget_header: settings.widget_header ?? '🤖 AI Assistant',
        widget_body: settings.widget_body ?? 'I\'m here to help you with any questions or tasks.',
        widget_greeting: settings.widget_greeting ?? '🎉 Welcome! I\'m your AI assistant!',
        widget_feature_tell: settings.widget_feature_tell ?? true,
        widget_feature_show: settings.widget_feature_show ?? true,
        widget_feature_do: settings.widget_feature_do ?? true,
        widget_feature_request_human: settings.widget_feature_request_human ?? true,
        widget_background_color: settings.widget_background_color ?? 'linear-gradient(135deg, #1BB55B45 0%, #987ADD45 100%)',
        widget_text_color: settings.widget_text_color ?? '#333333',
        widget_border_color: settings.widget_border_color ?? 'rgba(255, 255, 255, 0.3)',
        widget_accent_color: settings.widget_accent_color ?? '#1BB55B',
        widget_secondary_color: settings.widget_secondary_color ?? '#987ADD',
        widget_border_radius: settings.widget_border_radius ?? '12px',
        widget_font_size: settings.widget_font_size ?? '14px',
        widget_width: settings.widget_width ?? '360px',
        widget_height: settings.widget_height ?? '35rem',
        widget_shadow: settings.widget_shadow ?? '0 10px 25px rgba(0, 0, 0, 0.1)',
        widget_animation_duration: settings.widget_animation_duration ?? '300ms',
        widget_fade_duration: settings.widget_fade_duration ?? '200ms',
        widget_bounce_effect: settings.widget_bounce_effect ?? true,
        widget_z_index: 40,
        widget_chips: settings.widget_chips ?? []
      },

      // Widget text configuration - mapped from integration settings
      widget_text: {
        greeting: settings.widget_greeting ?? 'Hello! How can I help you today?',
        placeholder: 'Show me...',
        header_ai: settings.widget_header ?? 'AI Assistant',
        header_live: 'Live Agent',
        body_ai: settings.widget_body ?? 'I\'m here to help you with any questions or tasks.',
        body_live: 'A live agent will be with you shortly.',
        chat_greeting: settings.widget_greeting ?? 'Welcome to our chat! How can I assist you?',
        tour_greeting: 'Welcome! Let me show you around.'
      },

      // Widget customization - mapped from integration settings
      widget_customize: {
        colors: {
          primary: settings.widget_accent_color ?? '#1BB55B',
          secondary: settings.widget_secondary_color ?? '#987ADD',
          background: settings.widget_background_color ?? 'linear-gradient(135deg, #1BB55B26 0%, #987ADD30 100%)',
          text: settings.widget_text_color ?? '#333333',
          border: settings.widget_border_color ?? 'rgba(255, 255, 255, 0.2)'
        },
        sizes: {
          width: settings.widget_width ?? '320px',
          height: settings.widget_height ?? '35rem',
          border_radius: settings.widget_border_radius ?? '12px',
          font_size: settings.widget_font_size ?? '14px'
        },
        animations: {
          slide_duration: settings.widget_animation_duration ?? '300ms',
          fade_duration: settings.widget_fade_duration ?? '200ms',
          bounce_effect: settings.widget_bounce_effect ?? true
        }
      },

      // Widget position - converted from API format
      widget_position: {
        position: position as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
        offset: { x: 20, y: 20 },
        z_index: 40
      },

      // Widget visibility - from integration settings
      widget_visible: settings.widget_enabled ?? true,

      // Widget mode - default to AI
      widget_mode: 'ai' as const,

      // Avatar configuration - from integration settings
      active_avatar: {
        url: 'https://example.com/avatar.png',
        name: settings.widget_header?.replace(/<[^>]*>/g, '') ?? 'Marketrix Assistant',
        status: 'online' as const
      },

      // Avatar status - default values
      avatar_status: 'online' as const,
      streaming_avatar_status: 'idle' as const,

      // Additional atmosphere settings with defaults
      session_time: 0,
      sessionActive: false,
      recorded_time: 0,
      recordActive: false,
      widget_type: 'ai' as const,
      avatar_trigger_time: 0,
      enable_widget_popup: true,
      mLive_form: {
        enabled: false,
        fields: [],
        required: []
      },
      hybrid_agents_on: false,
      hybrid_agents_off: true,
      widget_visible_device: {
        desktop: true,
        tablet: true,
        mobile: true
      },
      enable_ai_tour: true,
      widget_header_ai: settings.widget_header ?? 'AI Assistant',
      widget_body_ai: settings.widget_body ?? 'I\'m here to help you with any questions or tasks.',
      widget_header_live: 'Live Agent',
      widget_body_live: 'A live agent will be with you shortly.',
      widget_chat_greeting: settings.widget_greeting ?? 'Welcome to our chat! How can I assist you?',
      widget_tour_greeting: 'Welcome! Let me show you around.',
      inapp_login_url: '',
      inapp_login_id: '',
      inapp_login_password: '',
      advanced_settings: {
        auto_open_delay: 0,
        session_timeout: 0,
        max_messages: 100,
        typing_indicator: true,
        read_receipts: true,
        sound_notifications: true,
        vibration_enabled: false
      },
      themes: {
        light: {
          background: settings.widget_background_color ?? '#ffffff',
          text: settings.widget_text_color ?? '#333333',
          border: settings.widget_border_color ?? '#e5e7eb',
          accent: settings.widget_accent_color ?? '#1BB55B'
        },
        dark: {
          background: '#1f2937',
          text: '#f9fafb',
          border: '#374151',
          accent: settings.widget_accent_color ?? '#1BB55B'
        }
      },
      responsive_breakpoints: {
        mobile: '768px',
        tablet: '1024px',
        desktop: '1280px'
      }
    };
  }

  /**
   * Load integration settings and convert to atmosphere config
   */
  async loadAtmosphereConfig(): Promise<any | null> {
    try {
      const integration = await this.fetchIntegrationSettings();
      if (integration) {
        return this.convertToAtmosphereConfig(integration);
      }
      return null;
    } catch (error) {
      console.error('Failed to load atmosphere config from integration:', error);
      return null;
    }
  }
}

export default IntegrationService;

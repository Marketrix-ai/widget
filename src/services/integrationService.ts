import { WidgetSettingsConfig } from '../types';

export interface IntegrationSettings {
  widget_enabled: boolean;
  widget_appearance: 'default' | 'compact' | 'full';
  widget_position: 'bottom-left' | 'bottom-right';
  widget_device: 'desktop' | 'mobile' | 'desktop_mobile';
  widget_header: string;
  widget_body: string;
  widget_greeting: string;
  widget_feature_tell: boolean;
  widget_feature_show: boolean;
  widget_feature_do: boolean;
  widget_feature_request_human: boolean;
  widget_background_color: string;
  widget_text_color: string;
  widget_border_color: string;
  widget_accent_color: string;
  widget_secondary_color: string;
  widget_border_radius: string;
  widget_font_size: string;
  widget_width: string;
  widget_height: string;
  widget_shadow: string;
  widget_animation_duration: string;
  widget_fade_duration: string;
  widget_bounce_effect: boolean;
  widget_chips: Array<{
    chip_mode: 'show' | 'tell' | 'do';
    chip_text: string;
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
  async fetchIntegrationSettings(): Promise<IntegrationSettings | null> {
    try {
      console.log('Fetching integration settings for:', { marketrixId: this.marketrixId, marketrixKey: this.marketrixKey });
      
      // Use direct fetch for now to avoid SDK type issues
      const response = await fetch(`http://localhost:8080/integration?marketrix_id=${this.marketrixId}&marketrix_key=${this.marketrixKey}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const integrations = data.data as any[];
        
        // Find the widget integration from the search results
        const widgetIntegration = integrations.find((integration: any) => 
          integration.type === 'widget' && 
          integration.status === 'active'
        );

        if (widgetIntegration && widgetIntegration.settings) {
          // Parse settings if they're stored as a JSON string
          let settings = widgetIntegration.settings;
          if (typeof settings === 'string') {
            try {
              settings = JSON.parse(settings);
            } catch (error) {
              console.error('Failed to parse settings JSON:', error);
              return null;
            }
          }
          
          console.log('Found widget integration settings:', settings);
          return settings as IntegrationSettings;
        }
      }

      console.warn('No widget integration found for the provided credentials');
      return null;
    } catch (error) {
      console.error('Failed to fetch integration settings:', error);
      return null;
    }
  }

  /**
   * Convert integration settings to widget configuration
   */
  convertToWidgetConfig(settings: IntegrationSettings): Partial<WidgetSettingsConfig> {
    return {
      widget_enabled: settings.widget_enabled,
      widget_appearance: settings.widget_appearance,
      widget_position: settings.widget_position,
      widget_device: settings.widget_device,
      widget_header: settings.widget_header,
      widget_body: settings.widget_body,
      widget_greeting: settings.widget_greeting,
      widget_feature_tell: settings.widget_feature_tell,
      widget_feature_show: settings.widget_feature_show,
      widget_feature_do: settings.widget_feature_do,
      widget_feature_request_human: settings.widget_feature_request_human,
      widget_background_color: settings.widget_background_color,
      widget_text_color: settings.widget_text_color,
      widget_border_color: settings.widget_border_color,
      widget_accent_color: settings.widget_accent_color,
      widget_secondary_color: settings.widget_secondary_color,
      widget_border_radius: settings.widget_border_radius,
      widget_font_size: settings.widget_font_size,
      widget_width: settings.widget_width,
      widget_height: settings.widget_height,
      widget_shadow: settings.widget_shadow,
      widget_animation_duration: settings.widget_animation_duration,
      widget_fade_duration: settings.widget_fade_duration,
      widget_bounce_effect: settings.widget_bounce_effect,
      widget_chips: settings.widget_chips,
    };
  }
}

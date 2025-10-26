import { type IntegrationData, sdk, type WidgetSettingsData } from '../sdk';
import { integrationToAtmosphere } from '../utils/configTransformers';

export class IntegrationService {
  private marketrixId: string;
  private marketrixKey: string;

  constructor(marketrixId: string, marketrixKey: string) {
    this.marketrixId = marketrixId;
    this.marketrixKey = marketrixKey;
  }

  /**
   * Fetch integration settings from the API
   */
  async fetchIntegrationSettings(): Promise<IntegrationData | null> {
    try {
      console.log('Fetching integration settings via SDK...');
      console.log('Marketrix ID:', this.marketrixId);
      console.log('Marketrix Key:', this.marketrixKey);

      const response = await sdk.integrationSearch({
        query: {
          marketrix_id: this.marketrixId,
          marketrix_key: this.marketrixKey,
        },
      });

      if (response.status === 200 && response.body?.success && response.body.data) {
        const integrations = response.body.data as IntegrationData[];

        // Find the widget integration from the search results
        const widgetIntegration = integrations.find(
          (integration: IntegrationData) =>
            integration.type === 'widget' && integration.status === 'active'
        );

        if (widgetIntegration) {
          console.log('Found widget integration via SDK:', widgetIntegration);
          console.log('Widget Integration Connection ID:', widgetIntegration.connection_id);
          return widgetIntegration;
        }
      }

      console.warn('No widget integration found for the provided credentials');
      return null;
    } catch (error) {
      console.error('Failed to fetch integration settings via SDK:', error);
      return null;
    }
  }

  /**
   * Get widget settings from integration data
   */
  getWidgetSettings(integration: IntegrationData): WidgetSettingsData | null {
    if (!integration?.settings) {
      return null;
    }

    // Parse settings if they're stored as a JSON string
    let settings: unknown = integration.settings;
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

    return settings as WidgetSettingsData;
  }

  /**
   * Convert integration settings to widget atmosphere configuration
   */
  convertToAtmosphereConfig(integration: IntegrationData): Record<string, unknown> | null {
    const result = integrationToAtmosphere(integration);
    return result as Record<string, unknown> | null;
  }

  /**
   * Load integration settings and convert to atmosphere config
   */
  async loadAtmosphereConfig(): Promise<Record<string, unknown> | null> {
    try {
      const integration = await this.fetchIntegrationSettings();
      if (integration) {
        return this.convertToAtmosphereConfig(integration);
      }
      return null;
    } catch (error) {
      console.error('Failed to load atmosphere config:', error);
      return null;
    }
  }

  /**
   * Convert integration settings to widget configuration
   */
  convertToWidgetConfig(settings: WidgetSettingsData): Partial<WidgetSettingsData> {
    return {
      widget_enabled: settings.widget_enabled ?? true,
      widget_appearance: settings.widget_appearance ?? 'default',
      widget_position: settings.widget_position ?? 'bottom_right',
      widget_device: settings.widget_device ?? 'desktop_mobile',
      widget_header: settings.widget_header ?? '🤖 AI Assistant',
      widget_body: settings.widget_body ?? "I'm here to help you with any questions or tasks.",
      widget_greeting: settings.widget_greeting ?? "🎉 Welcome! I'm your AI assistant!",
      widget_feature_tell: settings.widget_feature_tell ?? true,
      widget_feature_show: settings.widget_feature_show ?? true,
      widget_feature_do: settings.widget_feature_do ?? true,
      widget_feature_human: (settings.widget_feature_human as boolean) ?? true,
      widget_background_color:
        settings.widget_background_color ?? 'linear-gradient(135deg, #1BB55B45 0%, #987ADD45 100%)',
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
      widget_chips: settings.widget_chips ?? [],
    };
  }
}

export default IntegrationService;

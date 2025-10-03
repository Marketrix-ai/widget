import { IntegrationService } from '../sdk/integrationService';
import { MarketrixConfig } from '../types';

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

export class IntegrationSettingsService {
  private integrationService: IntegrationService;
  private settings: IntegrationSettings | null = null;
  private config: MarketrixConfig;

  constructor(config: MarketrixConfig) {
    this.config = config;
    this.integrationService = new IntegrationService(config.marketrixId, config.marketrixKey);
  }

  /**
   * Load integration settings from the API
   */
  async loadSettings(): Promise<IntegrationSettings | null> {
    try {
      console.log('Loading integration settings for:', this.config.marketrixId);
      const integrationData = await this.integrationService.fetchIntegrationSettings();
      this.settings = integrationData ? this.integrationService.getWidgetSettings(integrationData) : null;
      
      if (this.settings) {
        console.log('Integration settings loaded:', this.settings);
      } else {
        console.warn('No integration settings found');
      }
      
      return this.settings;
    } catch (error) {
      console.error('Failed to load integration settings:', error);
      return null;
    }
  }

  /**
   * Get current settings
   */
  getSettings(): IntegrationSettings | null {
    return this.settings;
  }

  /**
   * Update widget atmosphere with integration settings
   */
  updateWidgetAtmosphere(atmosphere: any): any {
    if (!this.settings) {
      console.warn('No integration settings available to update atmosphere');
      return atmosphere;
    }

    const updatedAtmosphere = { ...atmosphere };

    // Update widget settings from integration
    if (this.settings.widget_enabled !== undefined) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_enabled = this.settings.widget_enabled;
    }

    if (this.settings.widget_appearance) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_appearance = this.settings.widget_appearance;
    }

    if (this.settings.widget_position) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_position = this.settings.widget_position;
    }

    if (this.settings.widget_header) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_header = this.settings.widget_header;
    }

    if (this.settings.widget_body) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_body = this.settings.widget_body;
    }

    if (this.settings.widget_greeting) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_greeting = this.settings.widget_greeting;
    }

    // Update feature flags
    if (this.settings.widget_feature_tell !== undefined) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_feature_tell = this.settings.widget_feature_tell;
    }

    if (this.settings.widget_feature_show !== undefined) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_feature_show = this.settings.widget_feature_show;
    }

    if (this.settings.widget_feature_do !== undefined) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_feature_do = this.settings.widget_feature_do;
    }

    if (this.settings.widget_feature_request_human !== undefined) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_feature_request_human = this.settings.widget_feature_request_human;
    }

    // Update colors
    if (this.settings.widget_background_color) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_background_color = this.settings.widget_background_color;
    }

    if (this.settings.widget_text_color) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_text_color = this.settings.widget_text_color;
    }

    if (this.settings.widget_accent_color) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_accent_color = this.settings.widget_accent_color;
    }

    if (this.settings.widget_secondary_color) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_secondary_color = this.settings.widget_secondary_color;
    }

    // Update sizing
    if (this.settings.widget_width) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_width = this.settings.widget_width;
    }

    if (this.settings.widget_height) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_height = this.settings.widget_height;
    }

    if (this.settings.widget_border_radius) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_border_radius = this.settings.widget_border_radius;
    }

    if (this.settings.widget_font_size) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_font_size = this.settings.widget_font_size;
    }

    // Update animations
    if (this.settings.widget_animation_duration) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_animation_duration = this.settings.widget_animation_duration;
    }

    if (this.settings.widget_fade_duration) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_fade_duration = this.settings.widget_fade_duration;
    }

    if (this.settings.widget_bounce_effect !== undefined) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_bounce_effect = this.settings.widget_bounce_effect;
    }

    // Update chips
    if (this.settings.widget_chips) {
      updatedAtmosphere.widget_settings = updatedAtmosphere.widget_settings || {};
      updatedAtmosphere.widget_settings.widget_chips = this.settings.widget_chips;
    }

    console.log('Updated widget atmosphere with integration settings:', updatedAtmosphere.widget_settings);
    return updatedAtmosphere;
  }

  /**
   * Refresh settings from API
   */
  async refreshSettings(): Promise<IntegrationSettings | null> {
    return await this.loadSettings();
  }
}

export default IntegrationSettingsService;

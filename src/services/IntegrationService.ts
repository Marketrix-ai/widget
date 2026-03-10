import { sdk, type WidgetData, type WidgetSettingsData } from '../sdk';
import { isWidgetSettingsData } from '../utils/validation';

export class IntegrationService {
  private mtxId?: string;
  private mtxKey?: string;
  private mtxApp?: number;

  constructor(mtxId?: string, mtxKey?: string, mtxApp?: number) {
    this.mtxId = mtxId;
    this.mtxKey = mtxKey;
    this.mtxApp = mtxApp;
  }

  /**
   * Fetch integration settings from the API
   * Always returns default settings merged with existing integration settings if found
   * Returns null if no credentials provided (for preview mode)
   */
  async fetchIntegrationSettings(): Promise<WidgetData | null> {
    // Skip API call if no credentials provided (preview mode)
    if (!this.mtxId && !this.mtxKey && !this.mtxApp) {
      return null;
    }

    try {
      // First, fetch default widget settings - oRPC returns data directly
      const defaultSettings = await sdk.widgetGetDefaults({ type: 'widget' });

      if (!defaultSettings) {
        const error = 'Failed to fetch default widget settings from API. The API must return widget settings.';
        console.error(error);
        throw new Error(error);
      }

      // Then, try to fetch existing integration
      let integrationsData: WidgetData[] | null = null;
      if (this.mtxId && this.mtxKey) {
        integrationsData = await sdk.widgetSearch({
          type: 'widget',
          marketrix_id: this.mtxId,
          marketrix_key: this.mtxKey,
        });
      } else if (this.mtxApp) {
        integrationsData = await sdk.widgetSearch({
          type: 'widget',
          application_id: this.mtxApp,
        });
      } else {
        return null;
      }

      // Find active widget integration
      const widgetIntegration =
        integrationsData?.find(
          (integration: WidgetData) => integration.status === 'active' && integration.type === 'widget',
        ) || null;

      // If integration found, merge its settings over defaults
      if (widgetIntegration?.settings) {
        const integrationSettings = this.getWidgetSettings(widgetIntegration);
        if (integrationSettings) {
          // Merge defaults with integration settings (integration settings take precedence)
          const mergedSettings: WidgetSettingsData = {
            ...defaultSettings,
            ...integrationSettings,
          };

          return {
            ...widgetIntegration,
            settings: mergedSettings,
          };
        }
      }

      // No integration found, return defaults as a synthetic integration object
      const now = new Date();
      return {
        id: 0,
        connection_id: this.mtxApp || 0,
        agent_id: 0,
        type: 'widget' as const,
        settings: defaultSettings,
        status: 'active' as const,
        marketrix_id: this.mtxId || '',
        marketrix_key: this.mtxKey || '',
        created_at: now,
        updated_at: now,
      } as WidgetData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to fetch integration settings:', error);
      throw new Error(`Failed to fetch widget settings from API: ${errorMessage}`);
    }
  }

  /**
   * Get widget settings from integration data
   * Settings are always objects (current API format)
   */
  getWidgetSettings(integration: WidgetData): WidgetSettingsData | null {
    if (!integration?.settings) return null;

    const settings = integration.settings;

    if (isWidgetSettingsData(settings)) {
      return settings;
    }

    console.warn('Settings are not widget settings');
    return null;
  }
}

export default IntegrationService;

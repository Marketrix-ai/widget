import { type IntegrationData, sdk, type WidgetSettingsData } from '../sdk';
import { extractApiData, extractErrorMessage } from '../utils/apiUtils';
import { isString, isWidgetSettingsData } from '../utils/validation';

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
   * Returns null if no credentials provided (for preview mode)
   */
  async fetchIntegrationSettings(): Promise<IntegrationData | null> {
    // Skip API call if no credentials provided (preview mode)
    if (!this.mtxId && !this.mtxKey && !this.mtxApp) {
      return null;
    }

    try {
      let response;

      if (this.mtxId && this.mtxKey) {
        response = await sdk.integrationSearch({
          query: {
            type: 'widget',
            marketrix_id: this.mtxId,
            marketrix_key: this.mtxKey,
          },
        });
      } else if (this.mtxApp) {
        response = await sdk.integrationSearch({
          query: {
            type: 'widget',
            connection_id: this.mtxApp,
          },
        });
      } else {
        return null;
      }

      // Extract data from response: { success: true, data: [...] }
      const integrationsData = extractApiData<IntegrationData[]>(response);

      if (!integrationsData || !Array.isArray(integrationsData) || integrationsData.length === 0) {
        return null;
      }

      // Find active widget integration
      const widgetIntegration = integrationsData.find(
        (integration: IntegrationData) =>
          integration.status === 'active' && integration.type === 'widget'
      );

      return widgetIntegration || null;
    } catch (error) {
      console.error('Failed to fetch integration settings:', error);
      return null;
    }
  }

  /**
   * Get widget settings from integration data
   */
  getWidgetSettings(integration: IntegrationData): WidgetSettingsData | null {
    if (!integration?.settings) return null;

    // API returns settings as an object, but database might store as JSON string
    // The integration type defines settings as WidgetSettingsData | SlackSettingsData (union)
    // But at runtime it could be a string or a partial object
    let settings: unknown = integration.settings;

    if (isString(settings)) {
      try {
        settings = JSON.parse(settings);
      } catch (error) {
        console.error('Failed to parse settings JSON:', extractErrorMessage(error));
        return null;
      }
    }

    if (isWidgetSettingsData(settings)) {
      return settings;
    }

    // Try to partially match if it's an object but missing some optional fields
    // This is a fallback for when the type guard is too strict but the data is usable
    if (
      typeof settings === 'object' &&
      settings !== null &&
      'widget_enabled' in settings &&
      typeof (settings as Record<string, unknown>).widget_enabled === 'boolean'
    ) {
      return settings as unknown as WidgetSettingsData;
    }

    console.warn('Settings are not widget settings');
    return null;
  }
}

export default IntegrationService;

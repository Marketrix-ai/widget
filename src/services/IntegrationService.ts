import { type IntegrationData, sdk, type WidgetSettingsData } from '../sdk';
import { extractApiData, extractErrorMessage } from '../utils/apiUtils';
import { isString, isWidgetSettingsData } from '../utils/validation';

export class IntegrationService {
  private marketrixId?: string;
  private marketrixKey?: string;
  private connectionId?: number;

  constructor(marketrixId?: string, marketrixKey?: string, connectionId?: number) {
    this.marketrixId = marketrixId;
    this.marketrixKey = marketrixKey;
    this.connectionId = connectionId;
  }

  /**
   * Fetch integration settings from the API
   * Returns null if no credentials provided (for preview mode)
   */
  async fetchIntegrationSettings(): Promise<IntegrationData | null> {
    // Skip API call if no credentials provided (preview mode)
    if (!this.marketrixId && !this.marketrixKey && !this.connectionId) {
      return null;
    }

    try {
      let response;

      if (this.marketrixId && this.marketrixKey) {
        response = await sdk.integrationSearch({
          query: {
            type: 'widget',
            marketrix_id: this.marketrixId,
            marketrix_key: this.marketrixKey,
          },
        });
      } else if (this.connectionId) {
        response = await sdk.integrationSearch({
          query: {
            type: 'widget',
            connection_id: this.connectionId,
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

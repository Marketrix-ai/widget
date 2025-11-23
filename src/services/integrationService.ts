import { type IntegrationData, sdk, type SlackSettingsData, type WidgetSettingsData } from '../sdk';
import { extractApiData, extractErrorMessage } from '../utils/apiUtils';
import { isString, isWidgetSettingsData } from '../utils/validation/typeGuards';

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
   */
  async fetchIntegrationSettings(): Promise<IntegrationData | null> {
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
   * Handles both object format (from API) and JSON string format (from database)
   */
  getWidgetSettings(integration: IntegrationData): WidgetSettingsData | null {
    if (!integration?.settings) {
      return null;
    }

    let settings: WidgetSettingsData | SlackSettingsData;

    // API returns settings as an object, but database might store as JSON string
    if (isString(integration.settings)) {
      try {
        const parsed: unknown = JSON.parse(integration.settings);
        if (!isWidgetSettingsData(parsed)) {
          console.warn('Parsed settings are not widget settings');
          return null;
        }
        settings = parsed;
      } catch (error) {
        console.error('Failed to parse settings JSON:', extractErrorMessage(error));
        return null;
      }
    } else {
      // Settings is already an object
      settings = integration.settings;
    }

    // Type guard to check if this is widget settings (not Slack settings)
    if (isWidgetSettingsData(settings)) {
      return settings;
    }

    console.warn('Settings are not widget settings');
    return null;
  }
}

export default IntegrationService;

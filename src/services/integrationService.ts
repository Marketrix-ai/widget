import { type IntegrationData, sdk, type SlackSettingsData, type WidgetSettingsData } from '../sdk';
import { extractApiData } from '../utils/apiHelpers';
import { extractErrorMessage } from '../utils/errorHandling';
import { isString, isWidgetSettingsData } from '../utils/typeGuards';

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

      const integrationsData = extractApiData<IntegrationData[]>(response);
      if (integrationsData && Array.isArray(integrationsData)) {
        // Find the widget integration from the search results
        const widgetIntegration = integrationsData.find(
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
    let settings: WidgetSettingsData | SlackSettingsData = integration.settings;
    if (isString(settings)) {
      try {
        const parsed: unknown = JSON.parse(settings);
        if (isWidgetSettingsData(parsed)) {
          settings = parsed;
        } else {
          console.warn('Parsed settings are not widget settings');
          return null;
        }
      } catch (error) {
        console.error('Failed to parse settings JSON:', extractErrorMessage(error));
        return null;
      }
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

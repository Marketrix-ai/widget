import { type ApplicationData, sdk, type WidgetData } from '../sdk';
import type { MarketrixConfig } from '../types';
import { extractErrorMessage, handleApiError } from '../utils/apiUtils';

export interface WidgetValidationResult {
  isValid: boolean;
  error?: string;
  widget?: WidgetData;
  application?: ApplicationData;
}

/**
 * Validates widget config: either the widget (marketrix_id + marketrix_key) and its application exist,
 * or the application id exists.
 */
export class ValidationService {
  private config?: MarketrixConfig;

  /** Handles both the mtxId+mtxKey and mtxApp cases. */
  async validateConfig(config: MarketrixConfig): Promise<WidgetValidationResult> {
    this.config = config;
    if (config.mtxId && config.mtxKey) {
      return this.validateByMarketrixId(config.mtxId, config.mtxKey);
    }
    if (config.mtxApp) {
      return this.validateByApplication(config.mtxApp);
    }
    return {
      isValid: false,
      error: 'Please provide either (mtxId + mtxKey) OR mtxApp',
    };
  }

  private async validateByMarketrixId(mtxId: string, mtxKey: string): Promise<WidgetValidationResult> {
    try {
      console.log('Validating widget - fetching widget...', { mtxId, mtxKey });

      const { items: widgets } = await sdk.widgetSearch({
        marketrix_id: mtxId,
        marketrix_key: mtxKey,
      });

      if (!widgets || widgets.length === 0) {
        return {
          isValid: false,
          error: 'Widget not found or invalid credentials',
        };
      }

      console.log(
        'Found widgets:',
        widgets.length,
        widgets.map((i: WidgetData) => ({
          id: i.id,
          type: i.type,
          status: i.status,
          marketrix_id: i.marketrix_id,
        })),
      );

      const activeWidget = widgets.find((widget: WidgetData) => widget.type === 'widget' && widget.status === 'active');

      if (!activeWidget) {
        const widgetMatches = widgets.filter((widget: WidgetData) => widget.type === 'widget');

        if (widgetMatches.length > 0) {
          const statuses = widgetMatches.map((i: WidgetData) => i.status).join(', ');
          return {
            isValid: false,
            error: `Found widget(s) but none are active. Current status(es): ${statuses}. Please activate the widget in the dashboard.`,
          };
        }

        if (widgets.length === 0) {
          return {
            isValid: false,
            error: 'No widgets found for the provided marketrix_id and marketrix_key. Please verify your credentials.',
          };
        }

        const types = widgets.map((i: WidgetData) => i.type).join(', ');
        return {
          isValid: false,
          error: `No widget found. Found widget type(s): ${types}. Please create a widget.`,
        };
      }

      if (!activeWidget.application_id) {
        return {
          isValid: false,
          error: 'Widget missing application_id',
          widget: activeWidget,
        };
      }

      console.log('Validating application ID...', activeWidget.application_id);

      try {
        const application = await sdk.applicationGet({ application_id: activeWidget.application_id });

        console.log('Widget validation successful', {
          widget: activeWidget.id,
          application: application.id,
        });

        return {
          isValid: true,
          widget: activeWidget,
          application,
        };
      } catch (applicationError) {
        console.error('Error validating application:', applicationError);
        return {
          isValid: false,
          error: `Failed to validate application: ${extractErrorMessage(applicationError)}`,
          widget: activeWidget,
        };
      }
    } catch (error) {
      console.error('Widget validation error:', error);
      return handleApiError(error, 'Widget validation', this.config);
    }
  }

  private async validateByApplication(mtxApp: number): Promise<WidgetValidationResult> {
    try {
      console.log('Validating application by ID...', { mtxApp });

      const application = await sdk.applicationGet({ application_id: mtxApp });

      console.log('Application found:', {
        id: application.id,
        name: application.name,
        type: application.type,
        url: application.url,
        allowed_domains: application.allowed_domains,
      });

      console.log('Validation successful:', { application_id: mtxApp });

      return {
        isValid: true,
        application,
      };
    } catch (error) {
      console.error('Application validation error:', error);
      return handleApiError(error, 'Application validation', this.config);
    }
  }
}

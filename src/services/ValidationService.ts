import { type ApplicationData, sdk, type WidgetData } from '../sdk';
import type { MarketrixConfig } from '../types';
import { extractErrorMessage, handleApiError } from '../utils/apiUtils';

export interface WidgetValidationResult {
  isValid: boolean;
  error?: string;
  widget?: WidgetData;
  application?: ApplicationData;
}

/** mtxId + mtxKey are mandatory: an application id is a guessable integer, so keyless mode authenticated nothing while granting full agent access under the workspace. */
export async function validateConfig(config: MarketrixConfig): Promise<WidgetValidationResult> {
  if (config.mtxId && config.mtxKey) {
    return validateByMarketrixId(config.mtxId, config.mtxKey, config);
  }
  return {
    isValid: false,
    error: 'Please provide mtxId + mtxKey',
  };
}

async function validateByMarketrixId(
  mtxId: string,
  mtxKey: string,
  config: MarketrixConfig,
): Promise<WidgetValidationResult> {
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
    return handleApiError(error, 'Widget validation', config);
  }
}

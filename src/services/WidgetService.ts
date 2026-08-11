import { sdk, type WidgetData, type WidgetSettingsData, WidgetSettingsDataSchema } from '../sdk';
import type { MarketrixConfig } from '../types';
import { createConfigFromSettings } from './ConfigManager';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
}

function withCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as Error & { cause: unknown }).cause = cause;
  return error;
}

function widgetSearchError(error: unknown, config: MarketrixConfig): Error {
  const message = errorMessage(error);
  if (
    message.includes('Failed to fetch') ||
    message.includes('ERR_CONNECTION_REFUSED') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed')
  ) {
    return withCause(
      `Cannot connect to API server. Please ensure the API server is running at ${config.mtxApiHost || 'configured API server'}. Error: ${message}`,
      error,
    );
  }
  return withCause(`Widget validation failed: ${message}`, error);
}

export async function loadWidgetConfig(config: MarketrixConfig): Promise<MarketrixConfig> {
  const { mtxId, mtxKey } = config;
  if (!mtxId || !mtxKey) {
    throw new Error('Please provide mtxId + mtxKey');
  }

  let widgets: WidgetData[];
  try {
    ({ items: widgets } = await sdk.widgetSearch({ marketrix_id: mtxId, marketrix_key: mtxKey }));
  } catch (error) {
    throw widgetSearchError(error, config);
  }

  if (!widgets.length) {
    throw new Error('Widget not found or invalid credentials');
  }

  const activeWidget = widgets.find(widget => widget.type === 'widget' && widget.status === 'active');
  if (!activeWidget) {
    const widgetMatches = widgets.filter(widget => widget.type === 'widget');
    if (widgetMatches.length) {
      const statuses = widgetMatches.map(widget => widget.status).join(', ');
      throw new Error(
        `Found widget(s) but none are active. Current status(es): ${statuses}. Please activate the widget in the dashboard.`,
      );
    }

    const types = widgets.map(widget => widget.type).join(', ');
    throw new Error(`No widget found. Found widget type(s): ${types}. Please create a widget.`);
  }

  if (!activeWidget.application_id) {
    throw new Error('Widget missing application_id');
  }

  try {
    await sdk.applicationGet({ application_id: activeWidget.application_id });
  } catch (error) {
    throw withCause(`Failed to validate application: ${errorMessage(error)}`, error);
  }

  let defaults: WidgetSettingsData;
  try {
    defaults = await sdk.widgetDefaultGet({ type: 'widget' });
  } catch (error) {
    throw withCause(`Failed to fetch widget settings from API: ${errorMessage(error)}`, error);
  }

  const parsedSettings = WidgetSettingsDataSchema.safeParse({ ...defaults, ...activeWidget.settings });
  if (!parsedSettings.success) {
    const fields = [...new Set(parsedSettings.error.issues.map(issue => issue.path.join('.') || 'settings'))];
    throw new Error(`Widget settings are invalid: ${fields.join(', ')}`);
  }

  return {
    ...createConfigFromSettings(parsedSettings.data, config),
    mtxApp: activeWidget.application_id,
  };
}

/**
 * Resolves a host page's `mtxId`/`mtxKey` into the fully-populated widget config the rest of the runtime reads.
 *
 * `createConfigFromSettings` layers rendered settings over a partial `MarketrixConfig`. It takes the already-validated,
 * render-constants-dropped shape `parseWidgetSettings` returns — a caller holding a raw `WidgetSettingsData` (the
 * imperative preview's `settings` prop) parses it first.
 *
 * `loadWidgetConfig` is the credentialed lookup: `widgetSearch` by id+key, then the first `active` widget wins. An
 * inactive-only result reports the statuses it did find, because "no such widget" and "not activated in the dashboard"
 * are the two failures a host integrator actually hits and the credentials look identical in both. `mtxApp` comes from
 * that widget's `application_id` and never from caller config — the application id is a consequence of valid
 * credentials, never a host-supplied input. `applicationGet` confirms it still resolves; `widgetDefaultGet` supplies
 * the base that the tenant's own `settings` are spread OVER, so a field the tenant never set falls back to the api's
 * default rather than to undefined.
 *
 * `errorMessage` normalises an unknown throw to a string and `withCause` wraps a caller-facing message around it while
 * retaining the original as `cause`, so nothing here swallows the underlying failure. The probe strings matched on a
 * failed `widgetSearch` are the platform-specific texts browsers emit for an unreachable host — matching them turns a
 * dead api into "start the API server at <host>" instead of a misleading "widget validation failed".
 */
import { sdk, type WidgetData, type WidgetSettingsData } from '../sdk';
import type { MarketrixConfig, ValidWidgetConfig } from '../types';
import { invalidSettingsMessage, parseWidgetSettings, type WidgetRenderedSettings } from '../utils/validation';
import type { CredentialedConfig } from './StorageService';

export function createConfigFromSettings(
  widgetSettings: WidgetRenderedSettings,
  baseConfig: Partial<MarketrixConfig> = {},
): ValidWidgetConfig {
  return {
    ...baseConfig,
    ...widgetSettings,
  } as ValidWidgetConfig;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
}

function withCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as Error & { cause: unknown }).cause = cause;
  return error;
}

export async function loadWidgetConfig(config: MarketrixConfig): Promise<CredentialedConfig> {
  const { mtxId, mtxKey } = config;
  if (!mtxId || !mtxKey) {
    throw new Error('Please provide mtxId + mtxKey');
  }

  let widgets: WidgetData[];
  try {
    ({ items: widgets } = await sdk.widgetSearch({ marketrix_id: mtxId, marketrix_key: mtxKey }));
  } catch (error) {
    const message = errorMessage(error);
    const unreachable = ['Failed to fetch', 'ERR_CONNECTION_REFUSED', 'NetworkError', 'Network request failed'].some(
      probe => message.includes(probe),
    );
    throw withCause(
      unreachable
        ? `Cannot connect to API server. Please ensure the API server is running at ${config.mtxApiHost || 'configured API server'}. Error: ${message}`
        : `Widget validation failed: ${message}`,
      error,
    );
  }

  if (!widgets.length) {
    throw new Error('Widget not found or invalid credentials');
  }

  const activeWidget = widgets.find(widget => widget.status === 'active');
  if (!activeWidget) {
    const statuses = widgets.map(widget => widget.status).join(', ');
    throw new Error(
      `Found widget(s) but none are active. Current status(es): ${statuses}. Please activate the widget in the dashboard.`,
    );
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

  const parsedSettings = parseWidgetSettings({ ...defaults, ...activeWidget.settings });
  if (parsedSettings.invalidFields) {
    throw new Error(invalidSettingsMessage(parsedSettings.invalidFields));
  }

  return {
    ...createConfigFromSettings(parsedSettings.settings, config),
    mtxId,
    mtxKey,
    mtxApp: activeWidget.application_id,
  };
}

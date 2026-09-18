/**
 * Resolves a host page's `mtxId`/`mtxKey` credentials into the fully-populated widget config the rest
 * of the runtime reads.
 *
 * `loadWidgetConfig` looks the widget up by credentials and picks the first active result, reporting a
 * more specific reason (no such widget vs. not activated) when none is active.
 * `createConfigFromSettings` layers validated, rendered settings over a partial config.
 * `widgetLookupCache` memoizes a resolution so a settings-only update skips repeating the lookup.
 *
 * A failed lookup recognises the browser's own "host unreachable" errors and reports them as a
 * likely-offline api rather than a generic failure.
 */
import { sdk, type WidgetPublicData } from '../sdk';
import type { MarketrixConfig, ValidWidgetConfig } from '../types';
import { errorMessage, withCause } from '../utils/errors';
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

interface ResolvedWidget {
  settings: WidgetRenderedSettings;
  applicationId: number;
}

const widgetLookupCache = new Map<string, Promise<ResolvedWidget>>();

async function resolveActiveWidget(mtxId: string, mtxKey: string, mtxApiHost?: string): Promise<ResolvedWidget> {
  let widgets: WidgetPublicData[];
  try {
    ({ items: widgets } = await sdk.widgetPublicSearch({ marketrix_id: mtxId, marketrix_key: mtxKey }));
  } catch (error) {
    const message = errorMessage(error);
    const unreachable = ['Failed to fetch', 'ERR_CONNECTION_REFUSED', 'NetworkError', 'Network request failed'].some(
      probe => message.includes(probe),
    );
    throw withCause(
      unreachable
        ? `Cannot connect to API server. Please ensure the API server is running at ${mtxApiHost || 'configured API server'}. Error: ${message}`
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

  const parsedSettings = parseWidgetSettings(activeWidget.settings);
  if (parsedSettings.invalidFields) {
    throw new Error(invalidSettingsMessage(parsedSettings.invalidFields));
  }

  return { settings: parsedSettings.settings, applicationId: activeWidget.application_id };
}

export async function loadWidgetConfig(config: MarketrixConfig): Promise<CredentialedConfig> {
  const { mtxId, mtxKey } = config;
  if (!mtxId || !mtxKey) {
    throw new Error('Please provide mtxId + mtxKey');
  }

  const cacheKey = `${mtxId}:${mtxKey}`;
  let lookup = widgetLookupCache.get(cacheKey);
  if (!lookup) {
    lookup = resolveActiveWidget(mtxId, mtxKey, config.mtxApiHost);
    widgetLookupCache.set(cacheKey, lookup);
    lookup.catch(() => widgetLookupCache.delete(cacheKey));
  }

  const { settings, applicationId } = await lookup;
  return {
    ...createConfigFromSettings(settings, config),
    mtxId,
    mtxKey,
    mtxApp: applicationId,
    isPreviewMode: false,
  };
}

/**
 * Resolves a host page's `mtxId`/`mtxKey` into the fully-populated widget config the rest of the
 * runtime reads. `createConfigFromSettings` layers rendered settings over a partial `MarketrixConfig`;
 * it takes the already-validated, render-constants-dropped shape `parseWidgetSettings` returns — a
 * caller holding a raw `WidgetSettingsData` (the imperative preview's `settings` prop) parses it first.
 *
 * `loadWidgetConfig` is the credentialed lookup: `widgetPublicSearch` by id+key, then the first `active`
 * widget wins. An inactive-only result reports the statuses it did find, because "no such widget" and
 * "not activated in the dashboard" are the two failures a host integrator actually hits and the
 * credentials look identical in both. `mtxApp` comes from that widget's `application_id` and never from
 * caller config, since the application id is a consequence of valid credentials, never a host-supplied
 * input. `widgetPublicSearch`'s response is `WidgetPublicData` — status/application_id/settings only,
 * never the `marketrix_id`/`marketrix_key` pair this call authenticated with, nor the rendered embed
 * snippet.
 *
 * `widgetLookupCache` memoizes the resolved (settings, applicationId) pair by `mtxId:mtxKey`, keyed on
 * the in-flight promise so concurrent callers share one request. `updateMarketrixConfig` re-runs
 * `initWidget` with the same credentials on every client-owned settings change (theme, position, …), so
 * without this cache each such update re-issues the same credentialed search this call already made —
 * this is the ONE request per page load the api sees for a given tenant. A rejected lookup is deleted
 * from the cache before the throw propagates, so it is never memoized and the next call retries against
 * the api instead of replaying a stale failure — nothing here swallows the throw underneath it.
 *
 * The probe strings matched on a failed `widgetPublicSearch` are the platform-specific texts browsers
 * emit for an unreachable host — matching them turns a dead api into "start the API server at <host>"
 * instead of a misleading "widget validation failed".
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

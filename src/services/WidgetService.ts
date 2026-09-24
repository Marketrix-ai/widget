/**
 * Turns what a host page supplies into the fully-populated widget config the runtime reads.
 * `parseWidgetSettings` validates settings against the contract schema, `invalidSettingsMessage` names the
 * offending fields, and `loadWidgetConfig` looks a widget up by `mtxId`/`mtxKey` and merges its settings in.
 * Unknown settings keys are ignored, since the api may ship a new setting before this published bundle
 * knows it. `widgetPublicSearch` returns only live widgets, so a returned row is active.
 */
import { z } from 'zod';

import { type ApplicationWidgetPublicData, sdk } from '../sdk';
import { WidgetSettingsWriteSchema } from '../sdk/contracts/widgetSettings';
import type { MarketrixConfig, ValidWidgetConfig } from '../types';
import { errorMessage } from '../utils/errors';

const RenderedSettingsSchema = z.object(WidgetSettingsWriteSchema.shape);

export type WidgetRenderedSettings = z.infer<typeof RenderedSettingsSchema>;

export type CredentialedConfig = ValidWidgetConfig & { mtxId: string; mtxKey: string };

type WidgetSettingsResult =
  { settings: WidgetRenderedSettings; invalidFields?: undefined } | { settings?: undefined; invalidFields: string[] };

export function parseWidgetSettings(value: unknown): WidgetSettingsResult {
  const parsed = RenderedSettingsSchema.safeParse(value);
  if (parsed.success) return { settings: parsed.data };
  return { invalidFields: [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? 'settings')))] };
}

export const invalidSettingsMessage = (invalidFields: string[]): string =>
  `Widget settings are invalid: ${invalidFields.join(', ')}`;

const widgetLookupCache = new Map<string, Promise<WidgetRenderedSettings>>();

async function resolveActiveWidget(mtxId: string, mtxKey: string, mtxApiHost: string): Promise<WidgetRenderedSettings> {
  let widgets: ApplicationWidgetPublicData[];
  try {
    ({ items: widgets } = await sdk.widgetPublicSearch({ marketrix_id: mtxId, marketrix_key: mtxKey }));
  } catch (error) {
    const message = errorMessage(error);
    const unreachable = ['Failed to fetch', 'ERR_CONNECTION_REFUSED', 'NetworkError', 'Network request failed'].some(
      probe => message.includes(probe),
    );
    throw new Error(
      unreachable
        ? `Cannot connect to API server. Please ensure the API server is running at ${mtxApiHost}. Error: ${message}`
        : `Widget validation failed: ${message}`,
      { cause: error },
    );
  }

  const activeWidget = widgets[0];
  if (!activeWidget) {
    throw new Error('Widget not found or invalid credentials');
  }

  const parsedSettings = parseWidgetSettings(activeWidget.widget_settings);
  if (parsedSettings.invalidFields) {
    throw new Error(invalidSettingsMessage(parsedSettings.invalidFields));
  }

  return parsedSettings.settings;
}

export async function loadWidgetConfig(config: MarketrixConfig): Promise<CredentialedConfig> {
  const { mtxId, mtxKey, mtxApiHost } = config;
  const cacheKey = `${mtxApiHost}:${mtxId}:${mtxKey}`;
  let lookup = widgetLookupCache.get(cacheKey);
  if (!lookup) {
    lookup = resolveActiveWidget(mtxId, mtxKey, mtxApiHost);
    widgetLookupCache.set(cacheKey, lookup);
    lookup.catch(() => widgetLookupCache.delete(cacheKey));
  }

  return { ...config, ...(await lookup), isPreviewMode: false };
}

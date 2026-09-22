/**
 * Turns what a host page supplies into the fully-populated widget config the runtime reads.
 * `parseWidgetSettings` validates settings against the contract's settings schema, returning the rendered
 * settings or the offending field names; `invalidSettingsMessage` names them in one message.
 * `loadWidgetConfig` looks a widget up by `mtxId`/`mtxKey` and merges its settings over the host's config,
 * memoizing each resolution so a settings-only update skips repeating the lookup.
 *
 * Unknown settings keys are ignored rather than rejected, since the api may ship a new setting before this
 * published bundle knows it. `widgetPublicSearch` returns a row only for a live widget, so a returned row is
 * unconditionally active. A failed lookup recognises the browser's own "host unreachable" errors and
 * reports them as a likely-offline api rather than a generic failure.
 */
import { z } from 'zod';

import { type ApplicationWidgetPublicData, sdk } from '../sdk';
import { WidgetSettingsWriteSchema } from '../sdk/contracts/entities';
import type { MarketrixConfig, ValidWidgetConfig } from '../types';
import { errorMessage } from '../utils/errors';

const RenderedSettingsSchema = z.object(WidgetSettingsWriteSchema.shape);

export type WidgetRenderedSettings = z.infer<typeof RenderedSettingsSchema>;

export type CredentialedConfig = ValidWidgetConfig & { mtxId: string; mtxKey: string; mtxApp: number };

type WidgetSettingsResult =
  { settings: WidgetRenderedSettings; invalidFields?: undefined } | { settings?: undefined; invalidFields: string[] };

export function parseWidgetSettings(value: unknown): WidgetSettingsResult {
  const parsed = RenderedSettingsSchema.safeParse(value);
  if (parsed.success) return { settings: parsed.data };
  return { invalidFields: [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? 'settings')))] };
}

export const invalidSettingsMessage = (invalidFields: string[]): string =>
  `Widget settings are invalid: ${invalidFields.join(', ')}`;

interface ResolvedWidget {
  settings: WidgetRenderedSettings;
  applicationId: number;
}

const widgetLookupCache = new Map<string, Promise<ResolvedWidget>>();

async function resolveActiveWidget(mtxId: string, mtxKey: string, mtxApiHost?: string): Promise<ResolvedWidget> {
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
        ? `Cannot connect to API server. Please ensure the API server is running at ${mtxApiHost || 'configured API server'}. Error: ${message}`
        : `Widget validation failed: ${message}`,
      { cause: error },
    );
  }

  const activeWidget = widgets[0];
  if (!activeWidget) {
    throw new Error('Widget not found or invalid credentials');
  }

  if (!activeWidget.application_id) {
    throw new Error('Widget missing application_id');
  }

  const parsedSettings = parseWidgetSettings(activeWidget.widget_settings);
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
  return { ...config, ...settings, mtxId, mtxKey, mtxApp: applicationId, isPreviewMode: false };
}

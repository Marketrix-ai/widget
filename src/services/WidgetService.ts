import { sdk, type WidgetData, type WidgetSettingsData } from '../sdk';
import { isWidgetSettingsData } from '../utils/validation';

let cachedDefaults: WidgetSettingsData | null = null;

export function getWidgetSettings(widget: WidgetData): WidgetSettingsData | null {
  if (!widget.settings) return null;
  if (isWidgetSettingsData(widget.settings)) return widget.settings;
  console.warn('Settings are not widget settings');
  return null;
}

/** Default settings merged with the matched widget's settings; null with no credentials (preview mode). */
export async function fetchWidgetSettings(
  mtxId?: string,
  mtxKey?: string,
  mtxApp?: number,
): Promise<WidgetData | null> {
  if (!mtxId && !mtxKey && !mtxApp) {
    return null;
  }

  try {
    // Defaults are static per session — cache after the first fetch.
    if (!cachedDefaults) {
      cachedDefaults = (await sdk.widgetDefaultGet({ type: 'widget' })) as WidgetSettingsData;
    }
    const defaultSettings = cachedDefaults;

    if (!defaultSettings) {
      const error = 'Failed to fetch default widget settings from API. The API must return widget settings.';
      console.error(error);
      throw new Error(error);
    }

    let widgetsData: WidgetData[] | null = null;
    if (mtxId && mtxKey) {
      const result = await sdk.widgetSearch({
        type: 'widget',
        marketrix_id: mtxId,
        marketrix_key: mtxKey,
      });
      widgetsData = result.items;
    } else if (mtxApp) {
      const result = await sdk.widgetSearch({
        type: 'widget',
        application_id: mtxApp,
      });
      widgetsData = result.items;
    } else {
      return null;
    }

    const matchedWidget =
      widgetsData?.find((widget: WidgetData) => widget.status === 'active' && widget.type === 'widget') || null;

    if (matchedWidget?.settings) {
      const widgetSettings = getWidgetSettings(matchedWidget);
      if (widgetSettings) {
        const mergedSettings: WidgetSettingsData = {
          ...defaultSettings,
          ...widgetSettings,
        };

        return {
          ...matchedWidget,
          settings: mergedSettings,
        };
      }
    }

    const now = new Date();
    return {
      id: 0,
      application_id: mtxApp || 0,
      type: 'widget' as const,
      settings: defaultSettings,
      status: 'active' as const,
      marketrix_id: mtxId || '',
      marketrix_key: mtxKey || '',
      created_at: now,
      updated_at: now,
    } as WidgetData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch widget settings:', error);
    const wrappedError = new Error(`Failed to fetch widget settings from API: ${errorMessage}`);
    (wrappedError as Error & { cause: unknown }).cause = error;
    throw wrappedError;
  }
}

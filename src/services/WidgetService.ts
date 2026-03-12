import { sdk, type WidgetData, type WidgetSettingsData } from '../sdk';
import { isWidgetSettingsData } from '../utils/validation';

export class WidgetService {
  private mtxId?: string;
  private mtxKey?: string;
  private mtxApp?: number;

  constructor(mtxId?: string, mtxKey?: string, mtxApp?: number) {
    this.mtxId = mtxId;
    this.mtxKey = mtxKey;
    this.mtxApp = mtxApp;
  }

  /**
   * Fetch widget settings from the API
   * Always returns default settings merged with existing widget settings if found
   * Returns null if no credentials provided (for preview mode)
   */
  async fetchWidgetSettings(): Promise<WidgetData | null> {
    // Skip API call if no credentials provided (preview mode)
    if (!this.mtxId && !this.mtxKey && !this.mtxApp) {
      return null;
    }

    try {
      // First, fetch default widget settings - oRPC returns data directly
      const defaultSettings = await sdk.widgetGetDefaults({ type: 'widget' });

      if (!defaultSettings) {
        const error = 'Failed to fetch default widget settings from API. The API must return widget settings.';
        console.error(error);
        throw new Error(error);
      }

      // Then, try to fetch existing widget
      let widgetsData: WidgetData[] | null = null;
      if (this.mtxId && this.mtxKey) {
        widgetsData = await sdk.widgetSearch({
          type: 'widget',
          marketrix_id: this.mtxId,
          marketrix_key: this.mtxKey,
        });
      } else if (this.mtxApp) {
        widgetsData = await sdk.widgetSearch({
          type: 'widget',
          application_id: this.mtxApp,
        });
      } else {
        return null;
      }

      // Find active widget
      const matchedWidget =
        widgetsData?.find((widget: WidgetData) => widget.status === 'active' && widget.type === 'widget') || null;

      // If widget found, merge its settings over defaults
      if (matchedWidget?.settings) {
        const widgetSettings = this.getWidgetSettings(matchedWidget);
        if (widgetSettings) {
          // Merge defaults with widget settings (widget settings take precedence)
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

      // No widget found, return defaults as a synthetic widget object
      const now = new Date();
      return {
        id: 0,
        application_id: this.mtxApp || 0,
        agent_id: 0,
        type: 'widget' as const,
        settings: defaultSettings,
        status: 'active' as const,
        marketrix_id: this.mtxId || '',
        marketrix_key: this.mtxKey || '',
        created_at: now,
        updated_at: now,
      } as WidgetData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to fetch widget settings:', error);
      throw new Error(`Failed to fetch widget settings from API: ${errorMessage}`);
    }
  }

  /**
   * Get widget settings from widget data
   * Settings are always objects (current API format)
   */
  getWidgetSettings(widget: WidgetData): WidgetSettingsData | null {
    if (!widget?.settings) return null;

    const settings = widget.settings;

    if (isWidgetSettingsData(settings)) {
      return settings;
    }

    console.warn('Settings are not widget settings');
    return null;
  }
}

export default WidgetService;

import type { WidgetSettingsData } from '../sdk';
import {
  mapWidgetSettingsToSemanticTokens,
  type SemanticTokens,
  WIDGET_STYLE_SETTINGS_DEFAULTS,
  type WidgetStyleSettingsDefaults,
} from './semantic-tokens';

export function createSemanticTokens(settings: Partial<WidgetSettingsData> = {}): SemanticTokens {
  const merged: WidgetStyleSettingsDefaults = {
    ...WIDGET_STYLE_SETTINGS_DEFAULTS,
    widget_background_color: settings.widget_background_color ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_background_color,
    widget_text_color: settings.widget_text_color ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_text_color,
    widget_border_color: settings.widget_border_color ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_border_color,
    widget_accent_color: settings.widget_accent_color ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_accent_color,
    widget_secondary_color: settings.widget_secondary_color ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_secondary_color,
    widget_border_radius: settings.widget_border_radius ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_border_radius,
    widget_font_size: settings.widget_font_size ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_font_size,
    widget_width: settings.widget_width ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_width,
    widget_height: settings.widget_height ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_height,
    widget_shadow: settings.widget_shadow ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_shadow,
    widget_animation_duration:
      settings.widget_animation_duration ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_animation_duration,
    widget_fade_duration: settings.widget_fade_duration ?? WIDGET_STYLE_SETTINGS_DEFAULTS.widget_fade_duration,
  };

  return mapWidgetSettingsToSemanticTokens(merged);
}

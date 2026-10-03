/**
 * Tenant settings to the CSS custom properties inlined on the widget root, the widget's whole theming
 * mechanism: `themeCssProperties` plus the fixed `WIDGET_RADIUS_PX`. The focus ring is black or white against
 * the background rather than the accent, which has no guaranteed contrast.
 */
import { DEFAULT_WIDGET_SETTINGS } from '../sdk/contracts/widgetSettings';
import type { WidgetSettingsData } from '../types';
import { addOpacity, getContrastingColor } from '../utils/color';
import { SHADOW } from './component-tokens';

export const WIDGET_RADIUS_PX = Number.parseInt(DEFAULT_WIDGET_SETTINGS.widget_border_radius, 10);

type WidgetColorSettings = Pick<
  WidgetSettingsData,
  | 'widget_background_color'
  | 'widget_text_color'
  | 'widget_border_color'
  | 'widget_accent_color'
  | 'widget_secondary_color'
>;

export function themeCssProperties(settings: WidgetColorSettings): Record<`--${string}`, string> {
  const { widget_background_color: background, widget_text_color: text, widget_accent_color: accent } = settings;
  const secondary = settings.widget_secondary_color;
  return {
    '--foreground': text,
    '--card': background,
    '--primary': accent,
    '--foreground-muted': addOpacity(text, 0.6),
    '--foreground-faint': addOpacity(text, 0.4),
    '--primary-foreground': getContrastingColor(accent),
    '--secondary': secondary,
    '--secondary-foreground': getContrastingColor(secondary),
    '--secondary-bg': addOpacity(secondary, 0.2),
    '--border': settings.widget_border_color,
    '--ring': getContrastingColor(background),
    '--radius': `${WIDGET_RADIUS_PX}px`,
    '--duration-animation': DEFAULT_WIDGET_SETTINGS.widget_animation_duration,
    '--duration-fade': DEFAULT_WIDGET_SETTINGS.widget_fade_duration,
    '--shadow-card': SHADOW.card,
    '--shadow-button': SHADOW.button,
  };
}

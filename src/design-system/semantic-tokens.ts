/**
 * Turns per-tenant widget settings into the CSS custom properties inlined on the widget root — the
 * widget's entire theming mechanism (there is no dark mode).
 *
 * `themeCssProperties` maps a tenant's colour settings, plus their muted/faint/hover/contrast variants,
 * onto the `--var` map. `WIDGET_RADIUS_PX`, the two durations and the `SHADOW` tokens CSS reads are fixed.
 *
 * The focus ring colour is synthesized as black or white against the tenant's background rather than
 * using the tenant's accent colour, which has no guaranteed contrast against whatever sits next to it.
 */
import type { CSSProperties } from 'react';

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

export function themeCssProperties(settings: WidgetColorSettings): CSSProperties & Record<`--${string}`, string> {
  const { widget_background_color: background, widget_text_color: text, widget_accent_color: accent } = settings;
  const secondary = settings.widget_secondary_color;
  return {
    '--foreground': text,
    '--card': background,
    '--card-foreground': text,
    '--primary': accent,
    '--foreground-muted': addOpacity(text, 0.6),
    '--foreground-faint': addOpacity(text, 0.4),
    '--primary-foreground': getContrastingColor(accent),
    '--primary-hover': addOpacity(accent, 0.85),
    '--secondary': secondary,
    '--secondary-foreground': getContrastingColor(secondary),
    '--secondary-bg': addOpacity(secondary, 0.2),
    '--secondary-hover': addOpacity(secondary, 0.3),
    '--border': settings.widget_border_color,
    '--ring': getContrastingColor(background),
    '--ring-offset': background,
    '--radius': `${WIDGET_RADIUS_PX}px`,
    '--duration-animation': DEFAULT_WIDGET_SETTINGS.widget_animation_duration,
    '--duration-fade': DEFAULT_WIDGET_SETTINGS.widget_fade_duration,
    '--shadow-card': SHADOW.card,
    '--shadow-button': SHADOW.button,
  };
}

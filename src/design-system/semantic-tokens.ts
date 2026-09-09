/**
 * The one home for turning per-tenant widget settings into semantic design tokens and the CSS custom
 * properties inlined on the widget root — the widget's entire theming mechanism (no dark mode, no
 * class-based themes).
 *
 * Contents: the `SemanticTokens` shape (color / radius / motion); `WIDGET_RADIUS_PX`, exported because
 * `WidgetFab` needs the raw number for its SVG `rx`/`ry`, not a CSS string; `DURATION_ANIMATION` and
 * `DURATION_FADE`; `WidgetStyleSettingsDefaults` and `WIDGET_STYLE_SETTINGS_DEFAULTS`, the five colour
 * settings this file consumes and their fallbacks; `createSemanticTokens`, which resolves a partial
 * settings object against those defaults and derives the muted/faint/hover/contrast variants;
 * `semanticTokensToCssCustomProperties`, the token → `--var` map.
 *
 * Radius and both durations are fixed rather than per-tenant: every widget row in production holds these
 * values and no surface writes them. Settings are filtered for explicit `undefined` before merging —
 * a plain spread would let an `undefined` key shadow its default instead of falling back to it. The
 * `--var` map must cover every variable `index.css` `:host` declares, or that hardcoded fallback palette
 * shows through on the widget root.
 */
import type { WidgetSettingsData } from '../sdk';
import { addOpacity, getContrastingColor } from '../utils/color';

type SemanticTokens = {
  color: {
    background: string;
    foreground: string;
    foregroundMuted: string;
    foregroundFaint: string;
    border: string;
    primary: string;
    primaryForeground: string;
    primaryHover: string;
    secondary: string;
    secondaryForeground: string;
    secondaryBg: string;
    secondaryHover: string;
  };
  radius: string;
  motion: {
    durationAnimation: string;
    durationFade: string;
  };
};

export const WIDGET_RADIUS_PX = 12;
const DURATION_ANIMATION = '300ms';
const DURATION_FADE = '200ms';

type WidgetStyleSettingsDefaults = Pick<
  WidgetSettingsData,
  | 'widget_background_color'
  | 'widget_text_color'
  | 'widget_border_color'
  | 'widget_accent_color'
  | 'widget_secondary_color'
>;

const WIDGET_STYLE_SETTINGS_DEFAULTS: WidgetStyleSettingsDefaults = {
  widget_background_color: '#ffffff',
  widget_text_color: '#1f2937',
  widget_border_color: '#e5e7eb',
  widget_accent_color: '#3b82f6',
  widget_secondary_color: '#6b7280',
};

export function createSemanticTokens(settings: Partial<WidgetSettingsData> = {}): SemanticTokens {
  const overrides = Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined),
  ) as Partial<WidgetStyleSettingsDefaults>;
  const resolved = { ...WIDGET_STYLE_SETTINGS_DEFAULTS, ...overrides };
  return {
    color: {
      background: resolved.widget_background_color,
      foreground: resolved.widget_text_color,
      foregroundMuted: addOpacity(resolved.widget_text_color, 0.6),
      foregroundFaint: addOpacity(resolved.widget_text_color, 0.4),
      border: resolved.widget_border_color,
      primary: resolved.widget_accent_color,
      primaryForeground: getContrastingColor(resolved.widget_accent_color),
      primaryHover: addOpacity(resolved.widget_accent_color, 0.85),
      secondary: resolved.widget_secondary_color,
      secondaryForeground: '#ffffff',
      secondaryBg: addOpacity(resolved.widget_secondary_color, 0.2),
      secondaryHover: addOpacity(resolved.widget_secondary_color, 0.3),
    },
    radius: `${WIDGET_RADIUS_PX}px`,
    motion: {
      durationAnimation: DURATION_ANIMATION,
      durationFade: DURATION_FADE,
    },
  };
}

export function semanticTokensToCssCustomProperties(tokens: SemanticTokens): Record<string, string> {
  return {
    '--background': tokens.color.background,
    '--foreground': tokens.color.foreground,
    '--card': tokens.color.background,
    '--card-foreground': tokens.color.foreground,
    '--primary': tokens.color.primary,
    '--foreground-muted': tokens.color.foregroundMuted,
    '--foreground-faint': tokens.color.foregroundFaint,
    '--primary-foreground': tokens.color.primaryForeground,
    '--primary-hover': tokens.color.primaryHover,
    '--secondary': tokens.color.secondary,
    '--secondary-foreground': tokens.color.secondaryForeground,
    '--secondary-bg': tokens.color.secondaryBg,
    '--secondary-hover': tokens.color.secondaryHover,
    '--border': tokens.color.border,
    '--ring': tokens.color.primary,
    '--radius': tokens.radius,
    '--duration-animation': tokens.motion.durationAnimation,
    '--duration-fade': tokens.motion.durationFade,
  };
}

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

// Fixed, not per-tenant: every widget row in production holds these, and no surface writes them.
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

function mapWidgetSettingsToSemanticTokens(settings: WidgetStyleSettingsDefaults): SemanticTokens {
  return {
    color: {
      background: settings.widget_background_color,
      foreground: settings.widget_text_color,
      foregroundMuted: addOpacity(settings.widget_text_color, 0.6),
      foregroundFaint: addOpacity(settings.widget_text_color, 0.4),
      border: settings.widget_border_color,
      primary: settings.widget_accent_color,
      primaryForeground: getContrastingColor(settings.widget_accent_color),
      primaryHover: addOpacity(settings.widget_accent_color, 0.85),
      secondary: settings.widget_secondary_color,
      secondaryForeground: '#ffffff',
      secondaryBg: addOpacity(settings.widget_secondary_color, 0.2),
      secondaryHover: addOpacity(settings.widget_secondary_color, 0.3),
    },
    radius: `${WIDGET_RADIUS_PX}px`,
    motion: {
      durationAnimation: DURATION_ANIMATION,
      durationFade: DURATION_FADE,
    },
  };
}

export function createSemanticTokens(settings: Partial<WidgetSettingsData> = {}): SemanticTokens {
  // An explicit undefined must not shadow its default, which is what a plain spread would do.
  const overrides = Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined),
  ) as Partial<WidgetStyleSettingsDefaults>;
  return mapWidgetSettingsToSemanticTokens({ ...WIDGET_STYLE_SETTINGS_DEFAULTS, ...overrides });
}

// Inline styles on the widget root: must cover every var index.css `:host` defines, or that fallback shows through.
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
    '--muted': tokens.color.border,
    '--muted-foreground': tokens.color.secondary,
    '--border': tokens.color.border,
    '--ring': tokens.color.primary,
    '--radius': tokens.radius,
    '--duration-animation': tokens.motion.durationAnimation,
    '--duration-fade': tokens.motion.durationFade,
  };
}

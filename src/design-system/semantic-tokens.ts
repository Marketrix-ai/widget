import type { WidgetSettingsData } from '../sdk';
import { addOpacity, getContrastingColor } from '../utils/format';

export type SemanticTokens = {
  color: {
    background: string;
    foreground: string;
    foregroundMuted: string;
    foregroundFaint: string;
    border: string;
    borderMuted: string;
    primary: string;
    primaryForeground: string;
    primaryHover: string;
    primaryMuted: string;
    secondary: string;
    secondaryForeground: string;
    secondaryBg: string;
    secondaryHover: string;
  };
  radius: string;
  shadow: string;
  typography: {
    fontSizeBase: string;
  };
  motion: {
    durationAnimation: string;
    durationFade: string;
  };
  size: {
    widgetWidth: string;
    widgetHeight: string;
  };
};

export type WidgetStyleSettingsDefaults = Pick<
  WidgetSettingsData,
  | 'widget_background_color'
  | 'widget_text_color'
  | 'widget_border_color'
  | 'widget_accent_color'
  | 'widget_secondary_color'
  | 'widget_border_radius'
  | 'widget_font_size'
  | 'widget_width'
  | 'widget_height'
  | 'widget_shadow'
  | 'widget_animation_duration'
  | 'widget_fade_duration'
>;

export const WIDGET_STYLE_SETTINGS_DEFAULTS: WidgetStyleSettingsDefaults = {
  widget_background_color: '#ffffff',
  widget_text_color: '#1f2937',
  widget_border_color: '#e5e7eb',
  widget_accent_color: '#3b82f6',
  widget_secondary_color: '#6b7280',
  widget_border_radius: '20px',
  widget_font_size: '14px',
  widget_width: '400px',
  widget_height: '600px',
  widget_shadow: '0 5px 40px 0 rgba(0, 0, 0, 0.3)',
  widget_animation_duration: '300ms',
  widget_fade_duration: '200ms',
};

export function mapWidgetSettingsToSemanticTokens(settings: WidgetStyleSettingsDefaults): SemanticTokens {
  return {
    color: {
      background: settings.widget_background_color,
      foreground: settings.widget_text_color,
      foregroundMuted: addOpacity(settings.widget_text_color, 0.6),
      foregroundFaint: addOpacity(settings.widget_text_color, 0.4),
      border: settings.widget_border_color,
      borderMuted: addOpacity(settings.widget_border_color, 0.3),
      primary: settings.widget_accent_color,
      primaryForeground: getContrastingColor(settings.widget_accent_color),
      primaryHover: addOpacity(settings.widget_accent_color, 0.85),
      primaryMuted: addOpacity(settings.widget_accent_color, 0.3),
      secondary: settings.widget_secondary_color,
      secondaryForeground: '#ffffff',
      secondaryBg: addOpacity(settings.widget_secondary_color, 0.2),
      secondaryHover: addOpacity(settings.widget_secondary_color, 0.3),
    },
    radius: settings.widget_border_radius,
    shadow: settings.widget_shadow,
    typography: {
      fontSizeBase: settings.widget_font_size,
    },
    motion: {
      durationAnimation: settings.widget_animation_duration,
      durationFade: settings.widget_fade_duration,
    },
    size: {
      widgetWidth: settings.widget_width,
      widgetHeight: settings.widget_height,
    },
  };
}

export const DEFAULT_SEMANTIC_TOKENS: SemanticTokens =
  mapWidgetSettingsToSemanticTokens(WIDGET_STYLE_SETTINGS_DEFAULTS);

/**
 * Convert tokens to CSS custom properties.
 * Applied as inline styles on the widget root to override static CSS defaults
 * set by `:host` in index.css. Must cover every variable that Tailwind utilities
 * or base-component classes reference so the widget renders correctly inside
 * closed Shadow DOM regardless of host page styles.
 */
export function semanticTokensToCssCustomProperties(tokens: SemanticTokens): Record<string, string> {
  return {
    '--background': tokens.color.background,
    '--foreground': tokens.color.foreground,
    '--card': tokens.color.background,
    '--card-foreground': tokens.color.foreground,
    '--popover': tokens.color.background,
    '--popover-foreground': tokens.color.foreground,
    '--primary': tokens.color.primary,
    '--foreground-muted': tokens.color.foregroundMuted,
    '--foreground-faint': tokens.color.foregroundFaint,
    '--border-muted': tokens.color.borderMuted,
    '--primary-foreground': tokens.color.primaryForeground,
    '--primary-hover': tokens.color.primaryHover,
    '--primary-muted': tokens.color.primaryMuted,
    '--secondary': tokens.color.secondary,
    '--secondary-foreground': tokens.color.secondaryForeground,
    '--secondary-bg': tokens.color.secondaryBg,
    '--secondary-hover': tokens.color.secondaryHover,
    '--muted': tokens.color.border,
    '--muted-foreground': tokens.color.secondary,
    '--accent': tokens.color.background,
    '--accent-foreground': tokens.color.foreground,
    '--border': tokens.color.border,
    '--input': tokens.color.border,
    '--ring': tokens.color.primary,
    '--radius': tokens.radius,
    '--shadow': tokens.shadow,
    '--duration-animation': tokens.motion.durationAnimation,
    '--duration-fade': tokens.motion.durationFade,
    '--widget-width': tokens.size.widgetWidth,
    '--widget-height': tokens.size.widgetHeight,
  };
}

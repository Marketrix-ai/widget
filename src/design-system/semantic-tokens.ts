import type { WidgetSettingsData } from '../sdk';

export type SemanticTokens = {
  color: {
    background: string;
    foreground: string;
    border: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
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
  widget_border_radius: '16px',
  widget_font_size: '14px',
  widget_width: '400px',
  widget_height: '600px',
  widget_shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  widget_animation_duration: '300ms',
  widget_fade_duration: '200ms',
};

export function mapWidgetSettingsToSemanticTokens(settings: WidgetStyleSettingsDefaults): SemanticTokens {
  return {
    color: {
      background: settings.widget_background_color,
      foreground: settings.widget_text_color,
      border: settings.widget_border_color,
      primary: settings.widget_accent_color,
      primaryForeground: '#ffffff',
      secondary: settings.widget_secondary_color,
      secondaryForeground: '#ffffff',
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
 * Applied as inline styles on the widget root to override static CSS defaults.
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
    '--primary-foreground': tokens.color.primaryForeground,
    '--secondary': tokens.color.secondary,
    '--secondary-foreground': tokens.color.secondaryForeground,
    '--border': tokens.color.border,
    '--input': tokens.color.border,
    '--ring': tokens.color.primary,
    '--radius': tokens.radius,
    '--duration-animation': tokens.motion.durationAnimation,
    '--duration-fade': tokens.motion.durationFade,
    '--widget-width': tokens.size.widgetWidth,
    '--widget-height': tokens.size.widgetHeight,
  };
}

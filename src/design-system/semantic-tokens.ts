import type { WidgetSettingsData } from '../sdk';

export const SEMANTIC_TOKEN_CSS_VARS = {
  colorSurface: '--mx-color-surface',
  colorText: '--mx-color-text',
  colorBorder: '--mx-color-border',
  colorAccent: '--mx-color-accent',
  colorSecondary: '--mx-color-secondary',
  radiusMd: '--mx-radius-md',
  shadowMd: '--mx-shadow-md',
  fontSizeBase: '--mx-font-size-base',
  motionDurationAnimation: '--mx-motion-duration-animation',
  motionDurationFade: '--mx-motion-duration-fade',
  sizeWidgetWidth: '--mx-size-widget-width',
  sizeWidgetHeight: '--mx-size-widget-height',
} as const;

export type SemanticTokens = {
  color: {
    surface: string;
    text: string;
    border: string;
    accent: string;
    secondary: string;
  };
  radius: {
    md: string;
  };
  shadow: {
    md: string;
  };
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

// Baseline widget defaults documented in README preview settings.
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
      surface: settings.widget_background_color,
      text: settings.widget_text_color,
      border: settings.widget_border_color,
      accent: settings.widget_accent_color,
      secondary: settings.widget_secondary_color,
    },
    radius: {
      md: settings.widget_border_radius,
    },
    shadow: {
      md: settings.widget_shadow,
    },
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

export function semanticTokensToCssCustomProperties(tokens: SemanticTokens): Record<string, string> {
  return {
    [SEMANTIC_TOKEN_CSS_VARS.colorSurface]: tokens.color.surface,
    [SEMANTIC_TOKEN_CSS_VARS.colorText]: tokens.color.text,
    [SEMANTIC_TOKEN_CSS_VARS.colorBorder]: tokens.color.border,
    [SEMANTIC_TOKEN_CSS_VARS.colorAccent]: tokens.color.accent,
    [SEMANTIC_TOKEN_CSS_VARS.colorSecondary]: tokens.color.secondary,
    [SEMANTIC_TOKEN_CSS_VARS.radiusMd]: tokens.radius.md,
    [SEMANTIC_TOKEN_CSS_VARS.shadowMd]: tokens.shadow.md,
    [SEMANTIC_TOKEN_CSS_VARS.fontSizeBase]: tokens.typography.fontSizeBase,
    [SEMANTIC_TOKEN_CSS_VARS.motionDurationAnimation]: tokens.motion.durationAnimation,
    [SEMANTIC_TOKEN_CSS_VARS.motionDurationFade]: tokens.motion.durationFade,
    [SEMANTIC_TOKEN_CSS_VARS.sizeWidgetWidth]: tokens.size.widgetWidth,
    [SEMANTIC_TOKEN_CSS_VARS.sizeWidgetHeight]: tokens.size.widgetHeight,
  };
}

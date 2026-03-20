import {
  DEFAULT_SEMANTIC_TOKENS,
  mapWidgetSettingsToSemanticTokens,
  type SemanticTokens,
  WIDGET_STYLE_SETTINGS_DEFAULTS,
} from '../semantic-tokens';

export const THEME_ID_DEFAULT = 'default';

/** Default theme: standard contrast, widget style defaults. */
export const defaultTheme: SemanticTokens = DEFAULT_SEMANTIC_TOKENS;

/** Build default theme from widget style defaults (same as DEFAULT_SEMANTIC_TOKENS). */
export function getDefaultTheme(): SemanticTokens {
  return mapWidgetSettingsToSemanticTokens(WIDGET_STYLE_SETTINGS_DEFAULTS);
}

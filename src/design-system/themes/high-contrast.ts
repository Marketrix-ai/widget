import { DEFAULT_SEMANTIC_TOKENS, type SemanticTokens } from '../semantic-tokens';

export const THEME_ID_HIGH_CONTRAST = 'high-contrast';

/**
 * High-contrast theme: stronger contrast for text and borders.
 * Use for accessibility (e.g. prefers-contrast or user preference).
 */
export const highContrastTheme: SemanticTokens = {
  ...DEFAULT_SEMANTIC_TOKENS,
  color: {
    surface: '#ffffff',
    text: '#000000',
    border: '#000000',
    accent: '#0066cc',
    secondary: '#333333',
  },
};

import { DEFAULT_SEMANTIC_TOKENS, type SemanticTokens } from '../semantic-tokens';

export const THEME_ID_HIGH_CONTRAST = 'high-contrast';

export const highContrastTheme: SemanticTokens = {
  ...DEFAULT_SEMANTIC_TOKENS,
  color: {
    background: '#ffffff',
    foreground: '#000000',
    border: '#000000',
    primary: '#0066cc',
    primaryForeground: '#ffffff',
    secondary: '#333333',
    secondaryForeground: '#ffffff',
  },
};

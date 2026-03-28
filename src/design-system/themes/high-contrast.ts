import { addOpacity, darkenColor, getContrastingColor } from '../../utils/format';
import { DEFAULT_SEMANTIC_TOKENS, type SemanticTokens } from '../semantic-tokens';

export const THEME_ID_HIGH_CONTRAST = 'high-contrast';

const bg = '#ffffff';
const fg = '#000000';
const border = '#000000';
const primary = '#0066cc';
const secondary = '#333333';

export const highContrastTheme: SemanticTokens = {
  ...DEFAULT_SEMANTIC_TOKENS,
  color: {
    background: bg,
    foreground: fg,
    foregroundMuted: addOpacity(fg, 0.6),
    foregroundFaint: addOpacity(fg, 0.4),
    border,
    borderMuted: addOpacity(border, 0.3),
    inputBorder: darkenColor(border, 0.4),
    primary,
    primaryForeground: getContrastingColor(primary),
    primaryHover: addOpacity(primary, 0.85),
    primaryMuted: addOpacity(primary, 0.3),
    secondary,
    secondaryForeground: '#ffffff',
    secondaryBg: addOpacity(secondary, 0.2),
    secondaryHover: addOpacity(secondary, 0.3),
  },
};

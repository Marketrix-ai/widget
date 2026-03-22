export type SpacingToken = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const spacingScale: Record<SpacingToken, string> = {
  none: '0',
  '2xs': '1',
  xs: '0.5',
  sm: '1.5',
  md: '2',
  lg: '3',
  xl: '4',
  '2xl': '6',
};

export const SHADOW = {
  none: 'none',
  card: '0 1px 4px rgba(0,0,0,0.1)', // cards, message bubbles, chips
  section: '0 2px 8px rgba(0,0,0,0.06)', // header bar, tab bar
  panel: '0 12px 40px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)', // main widget panel
  fab: '0 2px 8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
  button: '0 4px 6px -1px rgba(0,0,0,0.1)', // scroll-to buttons
} as const;

export type ShadowToken = keyof typeof SHADOW;

/** Shared shadow tokens used across all widget components */
export const SHADOW = {
  /** Cards, message bubbles, chips — subtle elevation */
  card: '0 1px 4px rgba(0,0,0,0.1)',
  /** Header bar, tab bar — section separator */
  section: '0 2px 8px rgba(0,0,0,0.06)',
  /** Main widget panel — strong overlay elevation */
  panel: '0 12px 40px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)',
  /** FAB button */
  fab: '0 2px 8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
  /** Scroll-to buttons */
  button: '0 4px 6px -1px rgba(0,0,0,0.1)',
} as const;

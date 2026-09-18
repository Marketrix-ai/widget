/**
 * Every fixed design token the widget's components read: the `RADIUS`, `TEXT_TONE`, `TEXT_LEADING` and
 * `SHADOW` scales, `TAB_BAR_HEIGHT`, the `LAYER_TOKENS` z-index ladder, the `notificationToneStyles`
 * toast palette, and `getElevationStyle`, which turns a shadow token into a `boxShadow`.
 *
 * Per-tenant values live in `semantic-tokens.ts` instead — this file is only what no tenant can change.
 * `LAYER_TOKENS.showHighlight`/`showPopup` sit far above the rest of the ladder because Show mode's
 * coaching overlay mounts on the host page, outside the shadow root, and must outrank everything there.
 */
import type { CSSProperties } from 'react';

export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'pill';
export type TextTone = 'default' | 'muted' | 'faint' | 'inherit';
export type TextLeading = 'tight' | 'snug' | 'normal' | 'relaxed';
export type NotificationTone = 'info' | 'error' | 'neutral';

export const RADIUS: Record<RadiusToken, string> = {
  none: '0',
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  xl: 'calc(var(--radius) + 4px)',
  pill: 'var(--radius-pill)',
};

export const TEXT_TONE: Record<TextTone, string> = {
  default: 'var(--foreground)',
  muted: 'var(--foreground-muted)',
  faint: 'var(--foreground-faint)',
  inherit: 'inherit',
};

export const TEXT_LEADING: Record<TextLeading, string> = {
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
};

export const SHADOW = {
  none: 'none',
  card: '0 1px 4px rgba(0,0,0,0.1)',
  section: '0 2px 8px rgba(0,0,0,0.06)',
  panel: '0 12px 40px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)',
  fab: '0 2px 8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
  button: '0 4px 6px -1px rgba(0,0,0,0.1)',
} as const;

export type ShadowToken = keyof typeof SHADOW;

export const TAB_BAR_HEIGHT = 48;

const WIDGET_LAYER_BASE = 2147483001;

export const LAYER_TOKENS = {
  screenEdgeGlow: WIDGET_LAYER_BASE,
  panel: WIDGET_LAYER_BASE + 1,
  dialog: WIDGET_LAYER_BASE + 2,
  toast: WIDGET_LAYER_BASE + 3,
  showHighlight: 2147483645,
  showPopup: 2147483646,
};

export const notificationToneStyles: Record<
  NotificationTone,
  {
    background: string;
    border: string;
    titleColor: string;
    bodyColor: string;
    closeColor: string;
    actionBackground: string;
  }
> = {
  info: {
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    titleColor: '#0c4a6e',
    bodyColor: '#0369a1',
    closeColor: '#0284c7',
    actionBackground: '#e0f2fe',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    titleColor: '#b91c1c',
    bodyColor: '#b91c1c',
    closeColor: '#dc2626',
    actionBackground: '#fee2e2',
  },
  neutral: {
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    titleColor: '#1f2937',
    bodyColor: '#1f2937',
    closeColor: '#6b7280',
    actionBackground: 'transparent',
  },
};

export function getElevationStyle(token?: ShadowToken | null): CSSProperties | undefined {
  if (!token || token === 'none') {
    return undefined;
  }

  return { boxShadow: SHADOW[token] };
}

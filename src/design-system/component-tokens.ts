import type { CSSProperties } from 'react';

import { SHADOW, type ShadowToken } from './shadows';

export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'theme' | 'pill' | 'circle';
export type TextTone = 'default' | 'muted' | 'faint' | 'primary' | 'inherit';
export type TextLeading = 'tight' | 'snug' | 'normal' | 'relaxed';
export type NotificationTone = 'info' | 'error' | 'neutral';

export const RADIUS: Record<RadiusToken, string> = {
  none: '0',
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  xl: 'calc(var(--radius) + 4px)',
  theme: 'var(--radius)',
  pill: '9999px',
  circle: '9999px',
};

export const TEXT_TONE: Record<TextTone, string> = {
  default: 'var(--foreground)',
  muted: 'var(--foreground-muted)',
  faint: 'var(--foreground-faint)',
  primary: 'var(--primary)',
  inherit: 'inherit',
};

export const TEXT_LEADING: Record<TextLeading, string> = {
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
};

export const TAB_BAR_HEIGHT = 48;

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
    closeColor: '#7dd3fc',
    actionBackground: '#e0f2fe',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    titleColor: '#b91c1c',
    bodyColor: '#b91c1c',
    closeColor: '#f87171',
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

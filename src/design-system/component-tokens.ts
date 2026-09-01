import type { CSSProperties } from 'react';

import { SHADOW, type ShadowToken } from './shadows';

export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'theme' | 'pill' | 'circle';
export type TextTone = 'default' | 'muted' | 'faint' | 'primary' | 'inherit';
export type TextLeading = 'tight' | 'snug' | 'normal' | 'relaxed';
export type NotificationTone = 'info' | 'error' | 'neutral';

export const radiusClasses: Record<RadiusToken, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  theme: 'rounded-[var(--radius)]',
  pill: 'rounded-full',
  circle: 'rounded-full',
};

export const textToneClasses: Record<TextTone, string> = {
  default: 'text-foreground',
  muted: 'text-foreground-muted',
  faint: 'text-foreground-faint',
  primary: 'text-primary',
  inherit: 'text-inherit',
};

export const textLeadingClasses: Record<TextLeading, string> = {
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
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

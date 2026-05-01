import type { CSSProperties } from 'react';

import { SHADOW, type ShadowToken } from './shadows';

export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'theme' | 'pill' | 'circle';
export type TextTone = 'default' | 'muted' | 'faint' | 'primary' | 'success' | 'warning' | 'inherit';
export type TextLeading = 'tight' | 'snug' | 'normal' | 'relaxed';
export type NotificationTone = 'info' | 'error';

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
  success: 'text-success',
  warning: 'text-warning',
  inherit: 'text-inherit',
};

export const textLeadingClasses: Record<TextLeading, string> = {
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
};

export const controlSizeStyles = {
  header: { height: 40 },
  tabBar: { height: 48 },
  launcher: { width: 56, height: 56 },
  launcherCore: { width: 48, height: 48 },
} satisfies Record<string, CSSProperties>;

export const notificationToneStyles: Record<
  NotificationTone,
  {
    background: string;
    border: string;
    titleColor: string;
    bodyColor: string;
    closeColor: string;
    closeHoverColor: string;
    actionBackground: string;
  }
> = {
  info: {
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    titleColor: '#0c4a6e',
    bodyColor: '#0369a1',
    closeColor: '#7dd3fc',
    closeHoverColor: '#38bdf8',
    actionBackground: '#e0f2fe',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    titleColor: '#b91c1c',
    bodyColor: '#b91c1c',
    closeColor: '#f87171',
    closeHoverColor: '#ef4444',
    actionBackground: '#fee2e2',
  },
};

export function getElevationStyle(token?: ShadowToken | null): CSSProperties | undefined {
  if (!token || token === 'none') {
    return undefined;
  }

  return { boxShadow: SHADOW[token] };
}

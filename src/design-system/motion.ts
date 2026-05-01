export type MotionTokens = {
  durationAnimation: string;
  durationFade: string;
  easingStandard: string;
  /** Duration for reduced motion preference (instant) */
  durationReduced: string;
  /** Easing for reduced motion preference */
  easingReduced: string;
};

export const MOTION_TOKENS: MotionTokens = {
  durationAnimation: '300ms',
  durationFade: '200ms',
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  durationReduced: '0ms',
  easingReduced: 'linear',
};

/**
 * CSS media query for detecting reduced motion preference.
 * Use this to conditionally apply animations.
 */
export const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Check if the user prefers reduced motion.
 * Safe to call in browser environments only.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;
}

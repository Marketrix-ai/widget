import { useEffect } from 'react';

const MOBILE_MAX_WIDTH = 767;

/**
 * Locks body scroll when enabled (e.g. widget open on mobile).
 * Uses matchMedia('(max-width: 767px)') for mobile detection.
 * Restores overflow on disable or unmount.
 */
export function useScrollLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    if (!mql.matches) return;

    const doc = document.documentElement;
    const body = document.body;
    const prevDocOverflow = doc.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    doc.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      doc.style.overflow = prevDocOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [enabled]);
}

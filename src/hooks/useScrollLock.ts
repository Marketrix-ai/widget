/**
 * `useScrollLock` — hides `overflow` on html and body while enabled, but only under MOBILE_MAX_WIDTH,
 * where the open panel covers the page; on desktop the host page keeps scrolling. Restores the exact
 * previous values on release.
 */
import { useEffect } from 'react';

const MOBILE_MAX_WIDTH = 767;

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

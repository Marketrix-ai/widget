import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Inside the closed shadow root `document.activeElement` retargets to the HOST, so it never names an
 *  element of the widget's own tree — read focus through the container's own root instead. */
function activeElementIn(container: HTMLElement): HTMLElement | null {
  const root = container.getRootNode();
  return ((root instanceof ShadowRoot ? root.activeElement : document.activeElement) as HTMLElement) ?? null;
}

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    el => el.offsetParent !== null && !el.hasAttribute('aria-hidden'),
  );
}

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  options?: {
    onEscape?: () => void;
    focusTargetRef?: React.RefObject<HTMLElement | null>;
  },
) {
  const previousActiveRef = useRef(false);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const focusFirst = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = options?.focusTargetRef?.current;
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
    const list = getFocusables(container);
    if (list[0]) list[0].focus({ preventScroll: true });
  }, [containerRef, options?.focusTargetRef]);

  useEffect(() => {
    if (!isActive) {
      if (previousActiveRef.current) {
        previouslyFocusedRef.current?.focus({ preventScroll: true });
        previouslyFocusedRef.current = null;
      }
      previousActiveRef.current = false;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    if (!previousActiveRef.current) {
      previouslyFocusedRef.current = activeElementIn(container);
    }
    previousActiveRef.current = true;

    focusFirst();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        options?.onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusables(container);
      if (focusables.length === 0) return;
      const current = activeElementIn(container);
      const idx = current ? focusables.indexOf(current) : -1;
      if (idx === -1) return;
      if (e.shiftKey) {
        if (idx === 0) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        }
      } else {
        if (idx === focusables.length - 1) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, containerRef, focusFirst, options?.onEscape]);
}

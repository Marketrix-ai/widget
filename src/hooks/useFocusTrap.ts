/**
 * Focus trap for the messenger panel: while `isActive`, focus starts inside `containerRef`, Tab cycles
 * within it, Escape calls `onEscape`, and on deactivation focus returns to whatever held it before.
 *
 * The tabbable-candidate query is `utils/dom`'s shared `TABBABLE_SELECTOR`; `activeElementIn` reads the
 * focused element as seen from a container's own root; `getFocusables` lists a container's visible tabbable elements; and
 * `useFocusTrap(containerRef, isActive, {onEscape, focusTargetRef})` focuses `focusTargetRef` (else the
 * first focusable), installs one capture-phase `keydown` listener on `document`, and restores focus on
 * the active→inactive edge.
 *
 * Inside the widget's closed shadow root `document.activeElement` retargets to the HOST, never naming
 * an element of the widget's own tree; `activeElementIn` reads through `container.getRootNode()`
 * instead and is the ONE home for that retargeting — eslint's `no-restricted-properties` bans the bare
 * read everywhere else. Hand-rolled on purpose: `MessengerShell` is a NON-modal panel, not a Dialog,
 * and Base UI exposes no standalone focus trap; reaching it by making the panel a Dialog would inert
 * the customer's page. Both key arms bail unless focus is currently inside the container, since the
 * listener sits on `document` ahead of host-page handlers and an unguarded Escape would close the
 * widget mid-typing. Tab `preventDefault`s only at the two ends; `previousActiveRef` edge-triggers the
 * restore once on close, and `getFocusables` drops hidden/`aria-hidden` elements the selector can't express.
 */

import { useEffect, useRef } from 'react';

import { TABBABLE_SELECTOR } from '../utils/dom';

function activeElementIn(container: HTMLElement): HTMLElement | null {
  const root = container.getRootNode();
  return ((root instanceof ShadowRoot ? root.activeElement : document.activeElement) as HTMLElement) ?? null;
}

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
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

    const target = options?.focusTargetRef?.current ?? getFocusables(container)[0];
    target?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = activeElementIn(container);
      if (!current || !container.contains(current)) return;
      if (e.key === 'Escape') {
        options?.onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusables(container);
      if (focusables.length === 0) return;
      const idx = focusables.indexOf(current);
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
  }, [isActive, containerRef, options?.focusTargetRef, options?.onEscape]);
}

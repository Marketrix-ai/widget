/**
 * Shared pointer-drag skeleton for `useDragSnap` (`WidgetFab.tsx`) and `useResize`
 * (`MessengerShell.tsx`): track a pointer's delta in a ref, mutate the DOM directly per move, commit on
 * release. One event model for both — Pointer Events + rAF-batched moves, pointer capture, and
 * `pointercancel` — so resize gains capture-based unmount safety it never had, and drag-snap's flick
 * math and resize's clamp math each become just a `PointerGesture` reader.
 *
 * States: `idle` → `tracking` (past `thresholdPx`; 0 starts on the first move, matching a resize handle
 * where every pointerdown already is one) → `committing` (`onEnd` fires once, `gesture.cancelled`
 * telling a cancel from a real release, and calls `release.commit()` when the gesture is truly over —
 * immediately for a synchronous commit, or later, e.g. on `transitionend`, for an animated one;
 * `release.onAbandon` registers what to run if the widget unmounts, OR a new gesture completes, before
 * that commit fires — closing the leak class pass 49 fixed once for `useDragSnap` alone, now generic to
 * any consumer's animated commit. `phaseRef`, not the `isTracking` state it also sets, is what handlers
 * read synchronously for control flow — React's own bailout skips the render `isTracking` would
 * otherwise redundantly schedule while `idle`↔`tracking`↔`committing` moves without it changing.
 */
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';

export interface PointerGesture {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  pointerType: string;
  cancelled: boolean;
}

export interface ReleaseHandle {
  commit: () => void;
  onAbandon: (fn: () => void) => void;
}

type Phase = 'idle' | 'tracking' | 'committing';

export interface UsePointerTrackOptions {
  disabled?: boolean;
  thresholdPx?: number;
  onTrackStart?: () => void;
  onTrack: (gesture: PointerGesture) => void;
  onEnd: (gesture: PointerGesture, release: ReleaseHandle) => void;
}

export interface UsePointerTrackResult {
  isTracking: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
}

export function usePointerTrack({
  disabled = false,
  thresholdPx = 0,
  onTrackStart,
  onTrack,
  onEnd,
}: UsePointerTrackOptions): UsePointerTrackResult {
  const phaseRef = useRef<Phase>('idle');
  const [isTracking, setIsTracking] = useState(false);
  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setIsTracking(next !== 'idle');
  };

  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; dx: number; dy: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const abandonRef = useRef<(() => void) | null>(null);

  const cancelRaf = () => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  useEffect(
    () => () => {
      cancelRaf();
      abandonRef.current?.();
    },
    [],
  );

  const gestureFrom = (
    drag: NonNullable<typeof dragRef.current>,
    event: ReactPointerEvent,
    cancelled: boolean,
  ): PointerGesture => ({
    startX: drag.startX,
    startY: drag.startY,
    dx: drag.dx,
    dy: drag.dy,
    pointerType: event.pointerType,
    cancelled,
  });

  const end = (event: ReactPointerEvent, cancelled: boolean) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    cancelRaf();
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (phaseRef.current !== 'tracking') {
      setPhase('idle');
      return;
    }
    setPhase('committing');
    abandonRef.current?.();
    abandonRef.current = null;
    onEnd(gestureFrom(drag, event, cancelled), {
      commit: () => {
        abandonRef.current = null;
        setPhase('idle');
      },
      onAbandon: fn => {
        abandonRef.current = fn;
      },
    });
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if (disabled) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPhase(thresholdPx <= 0 ? 'tracking' : 'idle');
    if (thresholdPx <= 0) onTrackStart?.();
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;

    drag.dx = event.clientX - drag.startX;
    drag.dy = event.clientY - drag.startY;

    if (phaseRef.current === 'idle') {
      if (Math.hypot(drag.dx, drag.dy) <= thresholdPx) return;
      onTrackStart?.();
      setPhase('tracking');
    }

    if (rafRef.current === null) {
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const live = dragRef.current;
        if (live) onTrack(gestureFrom(live, event, false));
      });
    }
  };

  return {
    isTracking,
    onPointerDown,
    onPointerMove,
    onPointerUp: event => end(event, false),
    onPointerCancel: event => end(event, true),
  };
}

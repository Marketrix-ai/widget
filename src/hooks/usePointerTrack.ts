/**
 * The one pointer-drag skeleton `useDragSnap` (`WidgetFab.tsx`) and `useResize` (`MessengerShell.tsx`)
 * each re-implemented on a different event model: track delta in a ref, mutate the DOM directly per
 * move, commit on release. Here over ONE model — Pointer Events + rAF-batched moves, capture,
 * `pointercancel` — with each caller's own math (flick-snap, or clamped resize) layered on via
 * `onTrack`/`onRelease`.
 *
 * Three states in `phaseRef` (mirrored to `phase` state only so a consumer can re-render on it):
 * `idle` → `tracking` (past `thresholdPx`; 0 means every pointerdown already is one) → `committing`
 * (released; `onRelease` calls the `commit` it is handed synchronously for a resize, or later on
 * `transitionend` for a snap animation). An undragged pointerup never entered `tracking`, so a plain
 * click still reaches `onClick`; `onPointerCancel` always aborts to `idle` without `onRelease` — a
 * cancelled gesture never commits — calling `onCancel` first to undo whatever `onTrack` mutated. The
 * unmount effect runs whatever abort fn the in-flight `onRelease` last put on `abandonRef`, closing the
 * leak class pass 49 fixed once for `useDragSnap` alone. `phase` state exists only so a consumer can
 * re-render on it (e.g. a cursor); control flow reads `phaseRef` instead, since a handler snapshot from
 * one render (what `renderHook`-style tests and a real rapid-regrab both do) can still run after a later
 * render replaced `phase`. A fresh pointerdown always resets to `idle` (or `tracking` at threshold 0)
 * even mid-`committing` from a still-animating previous gesture — `abandonRef` is what reconciles that
 * overlap, not this hook holding the old one open.
 */
import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useRef, useState } from 'react';

export type PointerTrackPhase = 'idle' | 'tracking' | 'committing';

export interface UsePointerTrackOptions {
  disabled?: boolean;
  thresholdPx?: number;
  onTrackStart?: () => void;
  onTrack: (dx: number, dy: number, event: ReactPointerEvent) => void;
  onRelease: (
    dx: number,
    dy: number,
    event: ReactPointerEvent,
    commit: () => void,
    abandonRef: RefObject<(() => void) | null>,
  ) => void;
  onCancel?: () => void;
}

export interface UsePointerTrackResult {
  phase: PointerTrackPhase;
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  abandonRef: RefObject<(() => void) | null>;
}

export function usePointerTrack({
  disabled = false,
  thresholdPx = 0,
  onTrackStart,
  onTrack,
  onRelease,
  onCancel,
}: UsePointerTrackOptions): UsePointerTrackResult {
  const [phase, setPhaseState] = useState<PointerTrackPhase>('idle');
  const phaseRef = useRef<PointerTrackPhase>('idle');
  const setPhase = (next: PointerTrackPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
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
        if (live) onTrack(live.dx, live.dy, event);
      });
    }
  };

  const onPointerUp = (event: ReactPointerEvent) => {
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
    onRelease(
      drag.dx,
      drag.dy,
      event,
      () => {
        abandonRef.current = null;
        setPhase('idle');
      },
      abandonRef,
    );
  };

  const onPointerCancel = (event: ReactPointerEvent) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    cancelRaf();
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (phaseRef.current === 'tracking') onCancel?.();
    setPhase('idle');
  };

  return { phase, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, abandonRef };
}

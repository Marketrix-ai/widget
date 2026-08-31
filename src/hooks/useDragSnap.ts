import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { WidgetPosition } from '../types';
import { getAnchorTopLeft, getNearestCornerByTranslation } from '../utils/widgetPositioning';

const DRAG_THRESHOLD_PX = 5;
const SNAP_DURATION_MS = 600;
const SNAP_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

export interface UseDragSnapOptions {
  position: WidgetPosition;
  onDrag: (position: WidgetPosition) => void;
  isPreviewMode?: boolean;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseDragSnapResult {
  isDragging: boolean;
  pixelPositionStyle: { left: number; top: number } | undefined;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  suppressUntilRef: React.RefObject<number>;
}

export function useDragSnap({
  position,
  onDrag,
  isPreviewMode = false,
  wrapperRef,
}: UseDragSnapOptions): UseDragSnapResult {
  const [isDragging, setIsDragging] = useState(false);
  const [wrapperSize, setWrapperSize] = useState({ w: 56, h: 56 });
  const [, setViewportTick] = useState(0);
  const transitionEndRef = useRef<(() => void) | null>(null);

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
    lastX: number;
    lastY: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const suppressUntilRef = useRef(0);
  const velocityHistoryRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const lastVelocitySampleRef = useRef(0);

  const cancelRaf = () => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  React.useEffect(() => cancelRaf, []);

  React.useEffect(() => {
    if (isPreviewMode) return;
    const onResize = () => setViewportTick(t => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isPreviewMode]);

  const measureWrapper = useCallback(() => {
    if (!wrapperRef.current || typeof window === 'undefined') return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setWrapperSize(prev =>
      prev.w === rect.width && prev.h === rect.height ? prev : { w: rect.width, h: rect.height },
    );
  }, [wrapperRef]);

  useLayoutEffect(() => {
    measureWrapper();
    const ro = typeof window !== 'undefined' && wrapperRef.current ? new ResizeObserver(measureWrapper) : null;
    if (ro && wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro?.disconnect();
  }, [measureWrapper, position, wrapperRef]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const anchor = getAnchorTopLeft(position, vw, vh, wrapperSize.w, wrapperSize.h);
  const pixelPositionStyle = !isPreviewMode && vw > 0 && vh > 0 ? { left: anchor.x, top: anchor.y } : undefined;

  const projectVelocity = (v: number, decel = 0.999) => ((v / 1000) * decel) / (1 - decel);

  const getVelocityFromHistory = (): { x: number; y: number } => {
    const h = velocityHistoryRef.current;
    if (h.length < 2) return { x: 0, y: 0 };
    const dt = h[h.length - 1].t - h[0].t;
    if (dt <= 0) return { x: 0, y: 0 };
    return {
      x: ((h[h.length - 1].x - h[0].x) / dt) * 1000,
      y: ((h[h.length - 1].y - h[0].y) / dt) * 1000,
    };
  };

  const resetDragStyles = () => {
    cancelRaf();
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = '';
      wrapperRef.current.style.willChange = '';
      wrapperRef.current.style.transition = '';
    }
  };

  const commitPositionAfterAnimation = useCallback(
    (nextCorner: WidgetPosition, wrapper: HTMLDivElement) => {
      if (transitionEndRef.current) return;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        transitionEndRef.current = null;
        wrapper.style.transition = 'none';
        wrapper.style.willChange = '';
        onDrag(nextCorner);
        setIsDragging(false);
        requestAnimationFrame(() => {
          if (wrapperRef.current) {
            wrapperRef.current.style.transition = '';
          }
        });
      };
      transitionEndRef.current = done;
      const fallbackTimer = window.setTimeout(done, SNAP_DURATION_MS + 50);
      wrapper.addEventListener('transitionend', function onEnd(e: TransitionEvent) {
        if (e.target !== wrapper || e.propertyName !== 'left') return;
        window.clearTimeout(fallbackTimer);
        wrapper.removeEventListener('transitionend', onEnd);
        done();
      });
    },
    [onDrag, wrapperRef],
  );

  const snapToCorner = useCallback(
    (nextCorner: WidgetPosition, fromX: number, fromY: number) => {
      if (!wrapperRef.current || !pixelPositionStyle) {
        resetDragStyles();
        onDrag(nextCorner);
        setIsDragging(false);
        return;
      }
      cancelRaf();
      const wrapper = wrapperRef.current;
      const oldAnchor = getAnchorTopLeft(position, vw, vh, wrapperSize.w, wrapperSize.h);
      const newAnchor = getAnchorTopLeft(nextCorner, vw, vh, wrapperSize.w, wrapperSize.h);
      wrapper.style.transition = 'none';
      wrapper.style.transform = 'none';
      wrapper.style.willChange = 'left, top';
      wrapper.style.left = `${oldAnchor.x + fromX}px`;
      wrapper.style.top = `${oldAnchor.y + fromY}px`;
      requestAnimationFrame(() => {
        wrapper.style.transition = `left ${SNAP_DURATION_MS}ms ${SNAP_EASING}, top ${SNAP_DURATION_MS}ms ${SNAP_EASING}`;
        wrapper.style.left = `${newAnchor.x}px`;
        wrapper.style.top = `${newAnchor.y}px`;
      });
      commitPositionAfterAnimation(nextCorner, wrapper);
    },
    [
      commitPositionAfterAnimation,
      onDrag,
      pixelPositionStyle,
      position,
      vw,
      vh,
      wrapperSize.w,
      wrapperSize.h,
      wrapperRef,
    ],
  );

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    resetDragStyles();
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      lastX: 0,
      lastY: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      drag.dragging = true;
      setIsDragging(true);
      velocityHistoryRef.current = [];
      lastVelocitySampleRef.current = 0;
      if (wrapperRef.current) {
        wrapperRef.current.style.willChange = 'transform';
        wrapperRef.current.style.transition = 'none';
      }
    }

    if (!drag.dragging) return;

    drag.lastX = dx;
    drag.lastY = dy;

    const now = Date.now();
    if (now - lastVelocitySampleRef.current >= 10) {
      lastVelocitySampleRef.current = now;
      velocityHistoryRef.current = [
        ...velocityHistoryRef.current.slice(-5),
        { x: event.clientX, y: event.clientY, t: now },
      ];
    }

    if (rafRef.current === null) {
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const d = dragRef.current;
        const wrapper = wrapperRef.current;
        if (!wrapper || !d) return;
        wrapper.style.transform = `translate3d(${d.lastX}px, ${d.lastY}px, 0)`;
      });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    if (drag.dragging) {
      const v = getVelocityFromHistory();
      const projX = projectVelocity(v.x);
      const projY = projectVelocity(v.y);
      const projected = { dx: drag.lastX + projX, dy: drag.lastY + projY };

      const rect = wrapperRef.current?.getBoundingClientRect();
      const nextCorner = rect
        ? getNearestCornerByTranslation(
            projected,
            position,
            window.innerWidth,
            window.innerHeight,
            rect.width,
            rect.height,
          )
        : position;

      snapToCorner(nextCorner, drag.lastX, drag.lastY);
      suppressUntilRef.current = Date.now() + 600;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    endDrag(event);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    endDrag(event);
  };

  return {
    isDragging,
    pixelPositionStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    suppressUntilRef,
  };
}

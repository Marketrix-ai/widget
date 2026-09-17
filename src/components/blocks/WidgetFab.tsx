/**
 * `WidgetFab` — the launcher button: draggable via `useDragSnap`, positioned at the configured corner,
 * glowing while a reply or task is in flight, and showing the stop control while a task runs and the
 * panel is closed. Colours and z-index come from the tenant config; `pointerEvents: none` while open so
 * the panel beneath receives the clicks.
 *
 * Glow and activity ring are ONE class each, red or green keyed on the `data-tone` the error state
 * picks — the same data-attribute variant convention every other component here uses. The two icon
 * layers carry only their own transform and opacity; the transition they share is `.mtx-fab-icon-layer`.
 *
 * `useDragSnap` (below) layers flick-projected corner snapping on the shared `usePointerTrack` (see that
 * hook's header for the idle/tracking/committing skeleton): `onTrackStart` arms the transform, `onTrack`
 * mirrors the pointer into a `translate3d` and samples `velocityHistoryRef` so a flick lands where it was
 * heading — `projectFlickVelocity` (module-level, pure) turns that sample history into a projected pixel
 * delta: zero with fewer than two samples, else the average px/ms over the sampled span projected forward
 * in px/s. `onRelease` picks the nearest corner via `getNearestCornerByTranslation` and animates the
 * wrapper there for SNAP_DURATION_MS via `left`/`top` transitions; `commitPositionAfterAnimation` calls
 * `onPositionCommit` and the hook's own `commit()` on `transitionend` (with a timeout fallback, since a
 * hidden tab fires no transition events) — the committed corner is the one being animated TO, so two
 * snaps in flight cannot commit the abandoned one (`abandonRef`, owned by `usePointerTrack` and threaded
 * through as a parameter since it isn't available yet inside the very options object that creates it).
 * `suppressUntilRef` stamps a time after which a click may open the widget again, so the pointer-up that
 * ends a drag is not read as a tap. The wrapper is measured with a ResizeObserver in a layout effect so
 * the pixel position is right on the first paint; preview mode disables the resize listener and viewport
 * anchoring, though dragging itself stays live. Exported so `WidgetFab.test.tsx`'s `renderHook` case can
 * drive it directly.
 */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { SHADOW } from '../../design-system/component-tokens';
import { WIDGET_RADIUS_PX } from '../../design-system/semantic-tokens';
import { usePointerTrack } from '../../hooks/usePointerTrack';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { WidgetPosition } from '../../types';
import { getAnchorTopLeft, getNearestCornerByTranslation, getPanelPositionStyle } from '../../utils/widgetPositioning';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';

const DRAG_THRESHOLD_PX = 5;
const SNAP_DURATION_MS = 600;
const SNAP_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const VELOCITY_SAMPLE_INTERVAL_MS = 10;
const VELOCITY_HISTORY_SIZE = 6;

function projectFlickVelocity(
  history: Array<{ x: number; y: number; t: number }>,
  decel = 0.999,
): { x: number; y: number } {
  if (history.length < 2) return { x: 0, y: 0 };
  const first = history[0];
  const last = history[history.length - 1];
  if (!first || !last) return { x: 0, y: 0 };
  const dt = last.t - first.t;
  if (dt <= 0) return { x: 0, y: 0 };
  const project = (d: number) => ((d / dt) * decel) / (1 - decel);
  return { x: project(last.x - first.x), y: project(last.y - first.y) };
}

interface UseDragSnapOptions {
  position: WidgetPosition;
  onPositionCommit: (position: WidgetPosition) => void;
  isPreviewMode?: boolean;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}

interface UseDragSnapResult {
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
  onPositionCommit,
  isPreviewMode = false,
  wrapperRef,
}: UseDragSnapOptions): UseDragSnapResult {
  const [wrapperSize, setWrapperSize] = useState({ w: 56, h: 56 });
  const [, setViewportTick] = useState(0);
  const suppressUntilRef = useRef(0);
  const velocityHistoryRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const lastVelocitySampleRef = useRef(0);

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

  const resetDragStyles = () => {
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = '';
      wrapperRef.current.style.willChange = '';
      wrapperRef.current.style.transition = '';
      wrapperRef.current.style.left = '';
      wrapperRef.current.style.top = '';
    }
  };

  const commitPositionAfterAnimation = (
    nextCorner: WidgetPosition,
    wrapper: HTMLDivElement,
    commit: () => void,
    abandonRef: React.RefObject<(() => void) | null>,
  ) => {
    abandonRef.current?.();
    let finished = false;
    const detach = () => {
      finished = true;
      window.clearTimeout(fallbackTimer);
      wrapper.removeEventListener('transitionend', onEnd);
      abandonRef.current = null;
    };
    const done = () => {
      if (finished) return;
      detach();
      wrapper.style.transition = 'none';
      wrapper.style.willChange = '';
      wrapper.style.left = '';
      wrapper.style.top = '';
      onPositionCommit(nextCorner);
      requestAnimationFrame(() => {
        if (wrapperRef.current) wrapperRef.current.style.transition = '';
      });
      commit();
    };
    const fallbackTimer = window.setTimeout(done, SNAP_DURATION_MS + 50);
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== wrapper || e.propertyName !== 'left') return;
      done();
    };
    wrapper.addEventListener('transitionend', onEnd);
    abandonRef.current = detach;
  };

  const snapToCorner = (
    nextCorner: WidgetPosition,
    fromX: number,
    fromY: number,
    commit: () => void,
    abandonRef: React.RefObject<(() => void) | null>,
  ) => {
    if (!wrapperRef.current || !pixelPositionStyle) {
      resetDragStyles();
      onPositionCommit(nextCorner);
      commit();
      return;
    }
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
    commitPositionAfterAnimation(nextCorner, wrapper, commit, abandonRef);
  };

  const track = usePointerTrack({
    thresholdPx: DRAG_THRESHOLD_PX,
    onTrackStart: () => {
      velocityHistoryRef.current = [];
      lastVelocitySampleRef.current = 0;
      if (wrapperRef.current) {
        wrapperRef.current.style.willChange = 'transform';
        wrapperRef.current.style.transition = 'none';
      }
    },
    onTrack: (dx, dy, event) => {
      const now = Date.now();
      if (now - lastVelocitySampleRef.current >= VELOCITY_SAMPLE_INTERVAL_MS) {
        lastVelocitySampleRef.current = now;
        velocityHistoryRef.current = [
          ...velocityHistoryRef.current.slice(-(VELOCITY_HISTORY_SIZE - 1)),
          { x: event.clientX, y: event.clientY, t: now },
        ];
      }
      if (wrapperRef.current) wrapperRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    },
    onRelease: (dx, dy, _event, commit, abandonRef) => {
      const flick = projectFlickVelocity(velocityHistoryRef.current);
      const projected = { dx: dx + flick.x, dy: dy + flick.y };
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
      suppressUntilRef.current = Date.now() + 600;
      snapToCorner(nextCorner, dx, dy, commit, abandonRef);
    },
    onCancel: resetDragStyles,
  });

  return {
    isDragging: track.phase !== 'idle',
    pixelPositionStyle,
    onPointerDown: track.onPointerDown,
    onPointerMove: track.onPointerMove,
    onPointerUp: track.onPointerUp,
    onPointerCancel: track.onPointerCancel,
    suppressUntilRef,
  };
}

interface WidgetFabProps {
  onPositionCommit: (position: WidgetPosition) => void;
}

export const WidgetFab: React.FC<WidgetFabProps> = ({ onPositionCommit }) => {
  const {
    isPreviewMode = false,
    widget_accent_color: accentColor,
    widget_background_color: backgroundColor,
    widget_position: position,
    widget_position_z_index: zIndex,
  } = useWidgetConfig();
  const { state, actions } = useWidget();
  const open = state.isOpen;
  const taskRunning = state.isTaskRunning;
  const error = !!state.error;

  const showProcessingGlow = !open && (state.isAwaitingReply || taskRunning);
  const showStopControl = !open && taskRunning;
  const tone = error ? 'error' : 'processing';

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const {
    isDragging,
    pixelPositionStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    suppressUntilRef,
  } = useDragSnap({ position, onPositionCommit, isPreviewMode, wrapperRef });

  return (
    <Surface
      ref={wrapperRef as React.Ref<HTMLElement>}
      className='mtx-fab-anchor'
      data-animated={isDragging ? 'false' : 'true'}
      data-preview={isPreviewMode ? 'true' : 'false'}
      style={{
        zIndex,
        pointerEvents: open ? 'none' : 'auto',
        ...(isDragging ? pixelPositionStyle : getPanelPositionStyle(position)),
      }}
    >
      <Surface className='mtx-fab' data-open={open ? 'true' : 'false'}>
        {showProcessingGlow && <Surface className='mtx-fab-glow' data-tone={tone} aria-hidden />}

        {showStopControl && !isDragging && (
          <Button
            variant='secondary'
            size='sm'
            className='mtx-fab-stop'
            data-side={position.includes('left') ? 'left' : 'right'}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              actions.stopTask();
            }}
          >
            Stop
          </Button>
        )}

        <Button
          variant='bare'
          onClick={() => {
            if (Date.now() < suppressUntilRef.current) return;
            actions.toggleWidget();
          }}
          onDragStart={e => e.preventDefault()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className='mtx-fab-trigger'
          style={{
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          aria-label={open ? 'Close' : 'Open'}
          aria-live='polite'
        >
          <Flex className='mtx-fab-center'>
            <Surface
              className='mtx-fab-badge'
              style={{
                borderRadius: `${WIDGET_RADIUS_PX}px`,
                backgroundColor: open ? backgroundColor : accentColor,
                boxShadow: SHADOW.fab,
              }}
            >
              {showProcessingGlow && (
                <svg className='mtx-fab-ring' data-tone={tone} viewBox='0 0 54 54' fill='none' aria-hidden>
                  <rect
                    x='1.25'
                    y='1.25'
                    width='51.5'
                    height='51.5'
                    rx={WIDGET_RADIUS_PX + 1}
                    ry={WIDGET_RADIUS_PX + 1}
                  />
                </svg>
              )}

              <Flex
                className='mtx-fab-icon-layer'
                style={{ transform: open ? 'rotate(30deg) scale(0)' : 'rotate(0deg) scale(1)', opacity: open ? 0 : 1 }}
                aria-hidden={open}
              >
                <Avatar
                  src={MarketrixIcon}
                  alt=''
                  className='mtx-fab-avatar'
                  draggable={false}
                  onDragStart={e => e.preventDefault()}
                  style={{
                    borderRadius: `${WIDGET_RADIUS_PX}px`,
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              </Flex>

              <Flex
                className='mtx-fab-icon-layer'
                style={{ transform: open ? 'rotate(0deg) scale(1)' : 'rotate(-30deg) scale(0)', opacity: open ? 1 : 0 }}
                aria-hidden={!open}
              >
                <Icon name='chevronDown' size={24} className='mtx-fab-chevron' />
              </Flex>
            </Surface>
          </Flex>
        </Button>
      </Surface>
    </Surface>
  );
};

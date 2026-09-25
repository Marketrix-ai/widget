/**
 * `WidgetFab` — the launcher button: draggable to a corner (`useDragSnap`, off in preview mode), glowing
 * while a reply or task is in flight, and showing a stop control while a task runs and the panel is closed.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { SHADOW } from '../../design-system/component-tokens';
import { WIDGET_RADIUS_PX } from '../../design-system/semantic-tokens';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { WidgetPosition } from '../../types';
import {
  animateSnap,
  getAnchorTopLeft,
  getCorner,
  getPanelPositionStyle,
  getReleaseCorner,
  LAUNCHER_SIZE_PX,
  type PointerSample,
} from '../../utils/widgetPositioning';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';

const DRAG_THRESHOLD_PX = 5;
const VELOCITY_SAMPLE_INTERVAL_MS = 10;
const VELOCITY_HISTORY_SIZE = 6;

function useDragSnap(
  position: WidgetPosition,
  onPositionCommit: (position: WidgetPosition) => void,
  isPreviewMode: boolean,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
) {
  const [isDragging, setIsDragging] = useState(false);
  const abandonSnapRef = useRef<(() => void) | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
    lastX: number;
    lastY: number;
    samples: PointerSample[];
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const suppressUntilRef = useRef(0);

  const cancelRaf = () => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  useEffect(
    () => () => {
      cancelRaf();
      abandonSnapRef.current?.();
    },
    [],
  );

  const [wrapperSize, setWrapperSize] = useState({ w: LAUNCHER_SIZE_PX, h: LAUNCHER_SIZE_PX });
  const [, setViewportTick] = useState(0);

  useEffect(() => {
    if (isPreviewMode) return;
    const onResize = () => setViewportTick(t => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isPreviewMode]);

  const measureWrapper = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setWrapperSize(prev =>
      prev.w === rect.width && prev.h === rect.height ? prev : { w: rect.width, h: rect.height },
    );
  }, [wrapperRef]);

  useLayoutEffect(() => {
    measureWrapper();
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver(measureWrapper);
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [measureWrapper, position, wrapperRef]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const anchorOf = (corner: WidgetPosition) => getAnchorTopLeft(corner, vw, vh, wrapperSize.w, wrapperSize.h);
  const pixelPositioned = !isPreviewMode && vw > 0 && vh > 0;
  const anchor = anchorOf(position);
  const pixelPositionStyle = pixelPositioned ? { left: anchor.x, top: anchor.y } : undefined;

  const resetDragStyles = () => {
    cancelRaf();
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = '';
      wrapperRef.current.style.willChange = '';
      wrapperRef.current.style.transition = '';
      wrapperRef.current.style.left = '';
      wrapperRef.current.style.top = '';
    }
  };

  const commit = (nextCorner: WidgetPosition) => {
    onPositionCommit(nextCorner);
    setIsDragging(false);
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    resetDragStyles();
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isPreviewMode) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      lastX: 0,
      lastY: 0,
      samples: [],
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
      if (wrapperRef.current) {
        wrapperRef.current.style.willChange = 'transform';
        wrapperRef.current.style.transition = 'none';
      }
    }

    if (!drag.dragging) return;

    drag.lastX = dx;
    drag.lastY = dy;

    const now = Date.now();
    if (now - (drag.samples.at(-1)?.t ?? 0) >= VELOCITY_SAMPLE_INTERVAL_MS) {
      drag.samples = [
        ...drag.samples.slice(-(VELOCITY_HISTORY_SIZE - 1)),
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
    if (!drag.dragging) {
      endDrag(event);
      return;
    }
    const wrapper = wrapperRef.current;
    const rect = wrapper?.getBoundingClientRect();
    const nextCorner = rect
      ? getReleaseCorner(
          drag.samples,
          { dx: drag.lastX, dy: drag.lastY },
          position,
          window.innerWidth,
          window.innerHeight,
          rect.width,
          rect.height,
        )
      : position;
    if (wrapper && pixelPositioned) {
      cancelRaf();
      abandonSnapRef.current?.();
      abandonSnapRef.current = animateSnap(
        wrapper,
        { x: anchor.x + drag.lastX, y: anchor.y + drag.lastY },
        anchorOf(nextCorner),
        () => {
          abandonSnapRef.current = null;
          commit(nextCorner);
        },
      );
    } else {
      resetDragStyles();
      commit(nextCorner);
    }
    suppressUntilRef.current = Date.now() + 600;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
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

interface WidgetFabProps {
  onPositionCommit: (position: WidgetPosition) => void;
}

export const WidgetFab: React.FC<WidgetFabProps> = ({ onPositionCommit }) => {
  const {
    isPreviewMode,
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
  } = useDragSnap(position, onPositionCommit, isPreviewMode, wrapperRef);

  return (
    <Surface
      ref={wrapperRef}
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
            data-side={getCorner(position).horizontal}
            onClick={actions.stopTask}
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
          aria-label={open ? 'Close chat' : 'Open chat'}
          aria-expanded={open}
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

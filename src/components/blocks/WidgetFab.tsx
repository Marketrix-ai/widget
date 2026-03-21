import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { WidgetPosition } from '../../types';
import { getAnchorTopLeft, getNearestCornerByTranslation, getPositionClasses } from '../../utils/widgetPositioning';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

export interface WidgetFabProps {
  logo: string;
  open: boolean;
  processing?: boolean;
  error?: boolean;
  taskRunning?: boolean;
  tooltip?: string;
  onClick: () => void;
  onStop?: () => void;
  // Styling props resolved by consumer from widget config
  accentColor?: string;
  backgroundColor?: string;
  borderRadius?: string;
  tooltipBgColor?: string;
  tooltipTextColor?: string;
  zIndex?: number;
  // Position
  position: WidgetPosition;
  onDrag: (position: WidgetPosition) => void;
  isPreviewMode?: boolean;
}

const DRAG_THRESHOLD_PX = 5;
const SNAP_DURATION_MS = 600;
const SNAP_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const WidgetFab: React.FC<WidgetFabProps> = ({
  logo,
  open,
  processing = false,
  error = false,
  taskRunning = false,
  tooltip,
  onClick,
  onStop,
  accentColor,
  backgroundColor,
  borderRadius = '12px',
  tooltipBgColor,
  tooltipTextColor,
  zIndex = 50,
  position,
  onDrag,
  isPreviewMode = false,
}) => {
  const showProcessingGlow = !open && (processing || taskRunning);
  const showStopControl = !open && taskRunning && onStop != null;
  const glowClass = error ? 'marketrix-widget-button-error-glow' : 'marketrix-widget-button-processing-glow';
  const activityRingClass = error
    ? 'marketrix-widget-button-error-activity-ring'
    : 'marketrix-widget-button-processing-activity-ring';

  const activityRingRadius = Math.max(6, Math.min(22, Number.parseFloat(borderRadius) || 12));

  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
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

  // Cleanup RAF on unmount
  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Resize listener for viewport changes
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
  }, []);

  useLayoutEffect(() => {
    measureWrapper();
    const ro = typeof window !== 'undefined' && wrapperRef.current ? new ResizeObserver(measureWrapper) : null;
    if (ro && wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro?.disconnect();
  }, [measureWrapper, position]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const anchor = getAnchorTopLeft(position, vw, vh, wrapperSize.w, wrapperSize.h);
  const pixelPositionStyle = !isPreviewMode && vw > 0 && vh > 0 ? { left: anchor.x, top: anchor.y } : undefined;

  const effectivePositionClasses = getPositionClasses(position);
  const positionClass = isPreviewMode ? 'absolute' : 'fixed';

  const previewPositionStyle = isPreviewMode
    ? position.includes('top')
      ? {
          top: '20px',
          ...(position.includes('right') ? { right: '20px' } : { left: '20px' }),
        }
      : {
          bottom: '20px',
          ...(position.includes('right') ? { right: '20px' } : { left: '20px' }),
        }
    : {};

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
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
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
    [onDrag],
  );

  const snapToCorner = (nextCorner: WidgetPosition, fromX: number, fromY: number) => {
    if (!wrapperRef.current || !pixelPositionStyle) {
      resetDragStyles();
      onDrag(nextCorner);
      setIsDragging(false);
      return;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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
    commitPositionAfterAnimation(nextCorner, wrapper);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (open) return;
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

      let nextCorner: WidgetPosition;
      if (typeof window !== 'undefined' && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        nextCorner = getNearestCornerByTranslation(
          projected,
          position,
          window.innerWidth,
          window.innerHeight,
          rect.width,
          rect.height,
        );
      } else {
        nextCorner = position;
      }

      snapToCorner(nextCorner, drag.lastX, drag.lastY);
      suppressUntilRef.current = Date.now() + 600;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    resetDragStyles();
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    resetDragStyles();
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <Surface
      ref={wrapperRef as React.Ref<HTMLElement>}
      className={`${positionClass} ${pixelPositionStyle ? '' : effectivePositionClasses} ${isDragging ? '' : 'transition-transform duration-300 ease-in-out'}`}
      style={{
        zIndex,
        pointerEvents: 'auto',
        ...previewPositionStyle,
        ...pixelPositionStyle,
      }}
    >
      <Surface
        className={`
          group relative w-14 h-14 overflow-visible transition-all duration-300 ease-in-out
          ${open ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 hover:scale-110'}
        `}
      >
        {showProcessingGlow && <Surface className={glowClass} aria-hidden />}

        {showStopControl && !isDragging && (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onStop?.();
            }}
            className={`absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/25 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lg opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto ${position.includes('left') ? 'left-full ml-2' : 'right-full mr-2'}`}
            style={{ border: '1px solid rgba(255,255,255,0.25)' }}
            aria-label='Stop running task'
          >
            Stop
          </Button>
        )}

        <Button
          type='button'
          variant='primary'
          onClick={() => {
            if (Date.now() < suppressUntilRef.current) return;
            onClick();
          }}
          onDragStart={e => e.preventDefault()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className='relative z-10 w-14 h-14 min-w-14 rounded-[27px] border-0 bg-transparent p-0 text-primary-foreground'
          style={{
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          aria-label={open ? 'Close' : 'Open'}
          aria-live='polite'
        >
          <Flex className='w-full h-full items-center justify-center relative'>
            <Surface
              className={`
                relative w-12 h-12 overflow-hidden transition-[transform,opacity,background-color] duration-[167ms] ease-[cubic-bezier(0.33,0,0,1)]
                hover:scale-110 hover:duration-[250ms] active:scale-[0.85] active:duration-[134ms] active:ease-[cubic-bezier(0.45,0,0.2,1)]
                animate-launcher-entrance
              `}
              style={{
                borderRadius,
                backgroundColor: open ? backgroundColor : accentColor,
              }}
            >
              {showProcessingGlow && (
                // Activity ring: dynamic SVG with computed strokeDasharray — documented exception
                <svg className={activityRingClass} viewBox='0 0 54 54' fill='none' aria-hidden>
                  <rect
                    x='1.25'
                    y='1.25'
                    width='51.5'
                    height='51.5'
                    rx={activityRingRadius + 1}
                    ry={activityRingRadius + 1}
                  />
                </svg>
              )}

              {/* Logo: visible when closed */}
              <Flex
                className='absolute inset-0 items-center justify-center transition-[transform,opacity] duration-[160ms] linear'
                style={{
                  transform: open ? 'rotate(30deg) scale(0)' : 'rotate(0deg) scale(1)',
                  opacity: open ? 0 : 1,
                  transitionProperty: 'transform, opacity',
                  transitionDuration: '0.16s, 0.08s',
                  transitionTimingFunction: 'linear',
                }}
                aria-hidden={open}
              >
                <Avatar
                  src={logo}
                  alt=''
                  className='relative z-10 w-full h-full object-contain'
                  draggable={false}
                  onDragStart={e => e.preventDefault()}
                  style={{
                    borderRadius,
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              </Flex>

              {/* ChevronDown: visible when open */}
              <Flex
                className='absolute inset-0 items-center justify-center transition-[transform,opacity] duration-[160ms] linear'
                style={{
                  transform: open ? 'rotate(0deg) scale(1)' : 'rotate(-30deg) scale(0)',
                  opacity: open ? 1 : 0,
                  transitionProperty: 'transform, opacity',
                  transitionDuration: '0.16s, 0.08s',
                  transitionTimingFunction: 'linear',
                }}
                aria-hidden={!open}
              >
                <Icon name='chevronDown' size={24} className='relative z-10 text-foreground pointer-events-none' />
              </Flex>
            </Surface>
          </Flex>
        </Button>
      </Surface>

      {/* Tooltip */}
      {!open && tooltip != null && (
        <Surface
          className={`absolute bottom-16 ${position.includes('left') ? 'left-0' : 'right-0'} mb-2 px-3 py-2 text-sm rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
          style={{
            backgroundColor: tooltipBgColor,
            color: tooltipTextColor,
          }}
        >
          <Text as='span' className='text-inherit'>
            {tooltip}
          </Text>
          <Surface
            aria-hidden
            className={`absolute top-full ${position.includes('left') ? 'left-4' : 'right-4'} w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent`}
            style={{
              borderTopColor: tooltipBgColor,
            }}
          />
        </Surface>
      )}
    </Surface>
  );
};

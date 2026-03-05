import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { useWidget } from '../../hooks/useWidget';
import type { MarketrixConfig, WidgetPosition } from '../../types';
import { addOpacity, darkenColor, getContrastingColor } from '../../utils/format';
import {
  getAnchorTopLeft,
  getDeltaToCorner,
  getNearestCornerByTranslation,
  getPositionClasses,
} from '../../utils/widgetPositioning';
import { Button } from '../base/Button';

interface WidgetButtonProps {
  config: MarketrixConfig;
  onClick: () => void;
  onStopTask?: () => void;
  isOpen: boolean;
  isMinimized?: boolean;
  isLoading?: boolean;
  isTaskRunning?: boolean;
  hasError?: boolean;
  position: WidgetPosition;
  onPositionChange: (position: WidgetPosition) => void;
}

export const WidgetButton: React.FC<WidgetButtonProps> = ({
  config,
  onClick,
  onStopTask,
  isOpen,
  isMinimized = false,
  isLoading = false,
  isTaskRunning = false,
  hasError = false,
  position,
  onPositionChange,
}) => {
  const showProcessingGlow = !isOpen && (isLoading || isTaskRunning);
  const showStopControl = !isOpen && isTaskRunning && !!onStopTask;
  const glowClass = hasError ? 'marketrix-widget-button-error-glow' : 'marketrix-widget-button-processing-glow';
  const activityRingClass = hasError
    ? 'marketrix-widget-button-error-activity-ring'
    : 'marketrix-widget-button-processing-activity-ring';
  const [showWelcomeText, setShowWelcomeText] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [wrapperSize, setWrapperSize] = useState({ w: 56, h: 56 });
  const [, setViewportTick] = useState(0);
  const transitionEndRef = useRef<(() => void) | null>(null);

  // All drag state lives in refs to avoid React rerenders during drag.
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
  // Velocity history for Next.js-style momentum snap (sample every ~10ms)
  const velocityHistoryRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const lastVelocitySampleRef = useRef(0);

  const { config: widgetConfig, isPreviewMode } = useWidget({ config });
  const activityRingRadius = Math.max(6, Math.min(22, Number.parseFloat(widgetConfig.widget_border_radius) || 12));

  useEffect(() => {
    setShowWelcomeText(false);
    if (isMinimized) return;
    if (widgetConfig.widget_appearance !== 'default') return;

    let welcomeTimer: ReturnType<typeof setTimeout> | null = null;
    const buttonTimer = setTimeout(() => {
      welcomeTimer = setTimeout(() => {
        setShowWelcomeText(true);
      }, 2000);
    }, 100);

    return () => {
      clearTimeout(buttonTimer);
      if (welcomeTimer !== null) clearTimeout(welcomeTimer);
    };
  }, [widgetConfig.widget_appearance, isMinimized]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Measure wrapper for pixel positioning (Next.js-style: avoids teleport on snap)
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

  useEffect(() => {
    if (isPreviewMode) return;
    const onResize = () => setViewportTick(t => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isPreviewMode]);

  const effectivePosition = position;
  const zIndex = widgetConfig.widget_position_z_index ?? 50;
  const effectivePositionClasses = getPositionClasses(effectivePosition);
  const positionClass = isPreviewMode ? 'absolute' : 'fixed';

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const anchor = getAnchorTopLeft(effectivePosition, vw, vh, wrapperSize.w, wrapperSize.h);
  const pixelPositionStyle = !isPreviewMode && vw > 0 && vh > 0 ? { left: anchor.x, top: anchor.y } : undefined;

  const DRAG_THRESHOLD_PX = 5;

  const previewPositionStyle = isPreviewMode
    ? effectivePosition.includes('top')
      ? {
          top: '20px',
          ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }),
        }
      : {
          bottom: '20px',
          ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }),
        }
    : {};

  // Velocity in px/s; project to extra px for momentum (Next.js formula)
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

  // ---- Drag handlers ----
  // Strategy: keep CSS corner anchor classes intact.
  // Apply translate3d(deltaX, deltaY, 0) as offset from anchored position.
  // On drop, animate to nearest corner and then commit corner class.

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isOpen) return;
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
      setShowWelcomeText(false);
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
    (nextCorner: WidgetPosition) => {
      if (transitionEndRef.current) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) {
        onPositionChange(nextCorner);
        setIsDragging(false);
        return;
      }
      const done = () => {
        transitionEndRef.current = null;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = wrapper.getBoundingClientRect();
        const newAnchor = getAnchorTopLeft(nextCorner, vw, vh, rect.width, rect.height);
        wrapper.style.left = `${newAnchor.x}px`;
        wrapper.style.top = `${newAnchor.y}px`;
        wrapper.style.transition = '';
        wrapper.style.transform = '';
        onPositionChange(nextCorner);
        setIsDragging(false);
      };
      transitionEndRef.current = done;
      wrapper.addEventListener('transitionend', function onEnd(e: TransitionEvent) {
        if (e.propertyName !== 'transform') return;
        wrapper.removeEventListener('transitionend', onEnd);
        done();
      });
    },
    [onPositionChange],
  );

  const snapToCorner = (nextCorner: WidgetPosition) => {
    if (!wrapperRef.current || !pixelPositionStyle) {
      resetDragStyles();
      onPositionChange(nextCorner);
      setIsDragging(false);
      return;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const targetDelta = getDeltaToCorner(position, nextCorner, vw, vh, wrapperSize.w, wrapperSize.h);
    const wrapper = wrapperRef.current;
    wrapper.style.willChange = 'transform';
    wrapper.style.transition = 'transform 491ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    wrapper.style.transform = `translate3d(${targetDelta.dx}px, ${targetDelta.dy}px, 0)`;
    commitPositionAfterAnimation(nextCorner);
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

      snapToCorner(nextCorner);
      suppressUntilRef.current = Date.now() + 300;
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
    <div
      ref={wrapperRef}
      className={`${positionClass} ${pixelPositionStyle ? '' : effectivePositionClasses} ${isDragging ? '' : 'transition-all duration-300 ease-in-out'} ${showWelcomeText && !isOpen ? (effectivePosition.includes('left') ? 'transform translate-x-64' : 'transform -translate-x-64') : ''}`}
      style={{
        zIndex,
        pointerEvents: 'auto',
        ...previewPositionStyle,
        ...pixelPositionStyle,
      }}
    >
      <div className='group relative w-14 h-14 overflow-visible transition-all duration-300 ease-in-out'>
        {showProcessingGlow && <div className={glowClass} aria-hidden />}
        {showStopControl && !isDragging && (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onStopTask?.();
            }}
            className={`absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/25 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lg opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto ${effectivePosition.includes('left') ? 'left-full ml-2' : 'right-full mr-2'}`}
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
          className='relative z-10 w-14 h-14 min-w-14 rounded-[27px] border-0 bg-transparent marketrix-widget-btn-shine p-0'
          style={{
            color: getContrastingColor(widgetConfig.widget_accent_color),
            backgroundColor: 'transparent',
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          aria-label={isOpen ? 'Close' : 'Open'}
          aria-live='polite'
        >
          <div className='w-full h-full flex items-center justify-center relative'>
            <div
              className={`
                relative w-12 h-12 overflow-hidden ${isOpen ? 'marketrix-widget-icon-shine' : ''}
                transition-[transform,opacity,background-color] duration-[167ms] ease-[cubic-bezier(0.33,0,0,1)]
                hover:scale-110 hover:duration-[250ms] active:scale-[0.85] active:duration-[134ms] active:ease-[cubic-bezier(0.45,0,0.2,1)]
                animate-launcher-entrance
              `}
              style={{
                borderRadius: widgetConfig.widget_border_radius,
                backgroundColor: isOpen ? widgetConfig.widget_text_color : widgetConfig.widget_accent_color,
              }}
            >
              {showProcessingGlow && (
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
              {/* Logo icon: visible when closed; crossfade out when open */}
              <div
                className='absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-[160ms] linear'
                style={{
                  transform: isOpen ? 'rotate(30deg) scale(0)' : 'rotate(0deg) scale(1)',
                  opacity: isOpen ? 0 : 1,
                  transitionProperty: 'transform, opacity',
                  transitionDuration: '0.16s, 0.08s',
                  transitionTimingFunction: 'linear',
                }}
                aria-hidden={isOpen}
              >
                <img
                  src={MarketrixIcon}
                  alt=''
                  className='relative z-10 w-full h-full object-contain'
                  draggable={false}
                  onDragStart={e => e.preventDefault()}
                  style={{
                    borderRadius: widgetConfig.widget_border_radius,
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              </div>
              {/* ChevronDown icon: visible when open; crossfade in when open */}
              <div
                className='absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-[160ms] linear'
                style={{
                  transform: isOpen ? 'rotate(0deg) scale(1)' : 'rotate(-30deg) scale(0)',
                  opacity: isOpen ? 1 : 0,
                  transitionProperty: 'transform, opacity',
                  transitionDuration: '0.16s, 0.08s',
                  transitionTimingFunction: 'linear',
                }}
                aria-hidden={!isOpen}
              >
                <svg
                  className='w-6 h-6 relative z-10'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  style={{
                    color: getContrastingColor(widgetConfig.widget_text_color),
                    pointerEvents: 'none',
                  }}
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M19 9l-7 7-7-7' />
                </svg>
              </div>
            </div>
          </div>
        </Button>
      </div>

      {/* Welcome Text */}
      {!isOpen && showWelcomeText && widgetConfig.widget_appearance === 'default' && (
        <div
          className={`absolute ${effectivePosition.includes('left') ? 'right-16' : 'left-16'} bottom-0 px-4 py-3 text-sm rounded-lg shadow-lg w-64 ${effectivePosition.includes('left') ? 'animate-slide-in-right' : 'animate-slide-in-left'} cursor-pointer`}
          style={{
            backgroundColor: '#ffffff',
            backgroundImage: 'none',
            color: widgetConfig.widget_text_color,
            borderColor: widgetConfig.widget_border_color,
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
          onClick={onClick}
        >
          <div className='flex gap-2'>
            {effectivePosition.includes('left') && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={e => {
                  e.stopPropagation();
                  setShowWelcomeText(false);
                }}
                className='flex-shrink-0 w-4 h-4 min-w-0 p-0 flex align-top justify-start rounded-full hover:bg-gray-100 transition-colors duration-200'
                aria-label='Close welcome message'
              >
                <svg
                  className='w-full h-full text-gray-500 border-2 border-gray-500 rounded-full p-0.1'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </Button>
            )}

            <div className='flex-1'>
              <div className='font-medium'>{widgetConfig.widget_greeting}</div>
              <div style={{ color: addOpacity(widgetConfig.widget_text_color, 0.7) }}>{widgetConfig.widget_body}</div>
            </div>

            {effectivePosition.includes('right') && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={e => {
                  e.stopPropagation();
                  setShowWelcomeText(false);
                }}
                className='flex-shrink-0 w-4 h-4 min-w-0 p-0 flex align-top justify-start rounded-full hover:bg-gray-100 transition-colors duration-200'
                aria-label='Close welcome message'
              >
                <svg
                  className='w-full h-full text-gray-500 border-2 border-gray-500 rounded-full p-0.1'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </Button>
            )}
          </div>
          <div
            className={`absolute bottom-0 ${effectivePosition.includes('left') ? 'left-full' : 'right-full'} transform translate-y-1/2 w-0 h-0 border-t-4 border-b-4`}
            style={{
              [effectivePosition.includes('left') ? 'borderLeftColor' : 'borderRightColor']:
                widgetConfig.widget_background_color,
              [effectivePosition.includes('left') ? 'borderRightColor' : 'borderLeftColor']: 'transparent',
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
            }}
          />
        </div>
      )}

      {/* Tooltip */}
      {!isOpen && (!showWelcomeText || widgetConfig.widget_appearance === 'compact') && (
        <div
          className={`absolute bottom-16 ${effectivePosition.includes('left') ? 'left-0' : 'right-0'} mb-2 px-3 py-2 text-sm rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
          style={{
            backgroundColor: darkenColor(widgetConfig.widget_accent_color, 0.3),
            color: getContrastingColor(darkenColor(widgetConfig.widget_accent_color, 0.3)),
          }}
        >
          {'Support Agent'}
          <div
            className={`absolute top-full ${effectivePosition.includes('left') ? 'left-4' : 'right-4'} w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent`}
            style={{
              borderTopColor: darkenColor(widgetConfig.widget_accent_color, 0.3),
            }}
          />
        </div>
      )}
    </div>
  );
};

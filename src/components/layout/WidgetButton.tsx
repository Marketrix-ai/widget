import React, { useEffect, useRef, useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.png';
import { DARK_THEME_COLORS } from '../../constants/theme';
import { useWidget } from '../../hooks/useWidget';
import type { MarketrixConfig, WidgetPosition } from '../../types';
import { addOpacity, darkenColor, getContrastingColor } from '../../utils/format';
import {
  getAnchorTopLeft,
  getDeltaToCorner,
  getPositionClasses,
} from '../../utils/widgetPositioning';

interface WidgetButtonProps {
  config: MarketrixConfig;
  onClick: () => void;
  isOpen: boolean;
  isMinimized?: boolean;
  isScreenSharing?: boolean;
  position: WidgetPosition;
  onPositionChange: (position: WidgetPosition) => void;
}

export const WidgetButton: React.FC<WidgetButtonProps> = ({
  config,
  onClick,
  isOpen,
  isMinimized = false,
  isScreenSharing = false,
  position,
  onPositionChange,
}) => {
  const [showWelcomeText, setShowWelcomeText] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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

  const { config: widgetConfig, isPreviewMode } = useWidget({ config });

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

  const effectivePosition = position;
  const zIndex = widgetConfig.widget_position_z_index ?? 50;
  const effectivePositionClasses = getPositionClasses(effectivePosition);
  const positionClass = isPreviewMode ? 'absolute' : 'fixed';

  const MAGNET_DISTANCE = 140;
  const MAGNET_STRENGTH = 0.92;

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

  const snapToNearestCorner = (clientX: number, clientY: number) => {
    if (typeof window === 'undefined') return;
    const isRight = clientX >= window.innerWidth / 2;
    const isBottom = clientY >= window.innerHeight / 2;
    const next: WidgetPosition = isBottom
      ? isRight
        ? 'bottom_right'
        : 'bottom_left'
      : isRight
        ? 'top_right'
        : 'top_left';
    onPositionChange(next);
  };

  // ---- Drag handlers ----
  // Strategy: keep CSS corner anchor classes intact.
  // Apply translate3d(deltaX, deltaY, 0) as offset from anchored position.
  // This avoids any jumping. On drop, clear transform and snap corner.

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
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.dragging && Math.hypot(dx, dy) > 6) {
      drag.dragging = true;
      setIsDragging(true);
      setShowWelcomeText(false);
      // Hint GPU
      if (wrapperRef.current) {
        wrapperRef.current.style.willChange = 'transform';
        wrapperRef.current.style.transition = 'none';
      }
    }

    if (!drag.dragging) return;

    drag.lastX = dx;
    drag.lastY = dy;

    // Coalesce into single RAF
    if (rafRef.current === null) {
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const d = dragRef.current;
        const wrapper = wrapperRef.current;
        if (!wrapper || !d) return;

        let dx = d.lastX;
        let dy = d.lastY;

        if (typeof window !== 'undefined') {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const rect = wrapper.getBoundingClientRect();
          const w = rect.width;
          const h = rect.height;
          const anchor = getAnchorTopLeft(position, vw, vh, w, h);
          const centerX = anchor.x + w / 2 + dx;
          const centerY = anchor.y + h / 2 + dy;

          const edge = 20;
          const cornerCenters: { corner: WidgetPosition; x: number; y: number }[] = [
            { corner: 'top_left', x: edge + w / 2, y: edge + h / 2 },
            { corner: 'top_right', x: vw - edge - w / 2, y: edge + h / 2 },
            { corner: 'bottom_left', x: edge + w / 2, y: vh - edge - h / 2 },
            { corner: 'bottom_right', x: vw - edge - w / 2, y: vh - edge - h / 2 },
          ];

          let nearestDist = Infinity;
          let nearest: (typeof cornerCenters)[0] | null = null;
          for (const cc of cornerCenters) {
            const dist = Math.hypot(centerX - cc.x, centerY - cc.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = cc;
            }
          }

          if (nearest && nearestDist < MAGNET_DISTANCE) {
            const pull = Math.pow(1 - nearestDist / MAGNET_DISTANCE, 1.2) * MAGNET_STRENGTH;
            const target = getDeltaToCorner(position, nearest.corner, vw, vh, w, h);
            dx = dx + (target.dx - dx) * pull;
            dy = dy + (target.dy - dy) * pull;
          }
        }

        wrapper.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
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

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.dragging) {
      snapToNearestCorner(event.clientX, event.clientY);
      suppressUntilRef.current = Date.now() + 300;
    }
    resetDragStyles();
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    resetDragStyles();
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={wrapperRef}
      className={`${positionClass} ${isPreviewMode ? '' : effectivePositionClasses} ${isDragging ? '' : 'transition-all duration-300 ease-in-out'} ${showWelcomeText && !isOpen ? (effectivePosition.includes('left') ? 'transform translate-x-64' : 'transform -translate-x-64') : ''}`}
      style={{
        zIndex,
        pointerEvents: isOpen ? 'none' : 'auto',
        ...previewPositionStyle,
      }}
    >
      <button
        onClick={() => {
          if (Date.now() < suppressUntilRef.current) return;
          onClick();
        }}
        onDragStart={e => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={`
          relative w-14 h-14 rounded-[27px] transition-all duration-300 ease-in-out
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 hover:scale-110'}
          border-2 border-transparent
        `}
        style={{
          color: getContrastingColor(widgetConfig.widget_accent_color),
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        aria-label='Open Marketrix support chat'
      >
        <div className='w-full h-full flex items-center justify-center relative'>
          <div
            className='w-full h-full rounded flex items-center justify-center'
            style={{ backgroundColor: 'transparent' }}
          >
            <img
              src={MarketrixIcon}
              alt='Marketrix Icon'
              className='w-fit h-12'
              draggable={false}
              onDragStart={e => e.preventDefault()}
              style={{
                boxShadow: widgetConfig.widget_shadow,
                borderRadius: widgetConfig.widget_border_radius,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          </div>
          {!isOpen && isScreenSharing && (
            <div className='absolute top-1 right-1 w-3 h-3 rounded-full bg-gray-700 animate-pulse border-2 border-white' />
          )}
        </div>
      </button>

      {/* Welcome Text */}
      {!isOpen && showWelcomeText && widgetConfig.widget_appearance === 'default' && (
        <div
          className={`absolute ${effectivePosition.includes('left') ? 'right-16' : 'left-16'} bottom-0 px-4 py-3 text-sm rounded-lg shadow-lg w-64 ${effectivePosition.includes('left') ? 'animate-slide-in-right' : 'animate-slide-in-left'} cursor-pointer`}
          style={{
            backgroundColor: DARK_THEME_COLORS.white,
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
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowWelcomeText(false);
                }}
                className='flex-shrink-0 w-4 h-4 flex align-top justify-start rounded-full hover:bg-gray-100 transition-colors duration-200'
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
              </button>
            )}

            <div className='flex-1'>
              <div className='font-medium'>{widgetConfig.widget_greeting}</div>
              <div style={{ color: addOpacity(widgetConfig.widget_text_color, 0.7) }}>{widgetConfig.widget_body}</div>
            </div>

            {effectivePosition.includes('right') && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowWelcomeText(false);
                }}
                className='flex-shrink-0 w-4 h-4 flex align-top justify-start rounded-full hover:bg-gray-100 transition-colors duration-200'
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
              </button>
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

import React, { useRef } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { SHADOW } from '../../design-system/shadows';
import { useDragSnap } from '../../hooks/useDragSnap';
import type { WidgetPosition } from '../../types';
import { getPositionClasses } from '../../utils/widgetPositioning';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

export interface WidgetFabProps {
  open: boolean;
  processing?: boolean;
  error?: boolean;
  taskRunning?: boolean;
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

export const WidgetFab: React.FC<WidgetFabProps> = ({
  open,
  processing = false,
  error = false,
  taskRunning = false,
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

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const {
    isDragging,
    pixelPositionStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    suppressUntilRef,
  } = useDragSnap({ position, onDrag, isPreviewMode, wrapperRef });

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

  return (
    <Surface
      ref={wrapperRef as React.Ref<HTMLElement>}
      className={`${positionClass} ${pixelPositionStyle ? '' : effectivePositionClasses} ${isDragging ? '' : 'transition-transform duration-300 ease-in-out'}`}
      style={{
        zIndex,
        pointerEvents: open ? 'none' : 'auto',
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
          variant='bare'
          onClick={() => {
            if (Date.now() < suppressUntilRef.current) return;
            onClick();
          }}
          onDragStart={e => e.preventDefault()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className='relative z-10 w-14 h-14 min-w-14'
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
                boxShadow: SHADOW.fab,
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
                  src={MarketrixIcon}
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
      {!open && (
        <Surface
          className={`absolute bottom-16 ${position.includes('left') ? 'left-0' : 'right-0'} mb-2 px-3 py-2 text-sm rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
          style={{
            backgroundColor: tooltipBgColor,
            color: tooltipTextColor,
          }}
        >
          <Text as='span' className='text-inherit'>
            Support Agent
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

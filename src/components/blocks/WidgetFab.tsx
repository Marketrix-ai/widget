/**
 * `WidgetFab` — the launcher button: draggable via `useDragSnap`, positioned at the configured corner,
 * glowing while a reply or task is in flight (an error switches the glow class), and showing the stop
 * control while a task runs and the panel is closed. Colours and z-index come from the tenant config;
 * `pointerEvents: none` while open so the panel beneath receives the clicks.
 */
import React, { useRef } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { SHADOW } from '../../design-system/component-tokens';
import { WIDGET_RADIUS_PX } from '../../design-system/semantic-tokens';
import { useDragSnap } from '../../hooks/useDragSnap';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { WidgetPosition } from '../../types';
import { getPanelPositionStyle } from '../../utils/widgetPositioning';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';

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
  const glowClass = error ? 'marketrix-widget-button-error-glow' : 'marketrix-widget-button-processing-glow';
  const activityRingClass = error
    ? 'marketrix-widget-button-error-activity-ring'
    : 'marketrix-widget-button-processing-activity-ring';

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
        {showProcessingGlow && <Surface className={glowClass} aria-hidden />}

        {showStopControl && !isDragging && (
          <Button
            type='button'
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
          type='button'
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
                <svg className={activityRingClass} viewBox='0 0 54 54' fill='none' aria-hidden>
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
                style={{
                  transform: open ? 'rotate(0deg) scale(1)' : 'rotate(-30deg) scale(0)',
                  opacity: open ? 1 : 0,
                  transitionProperty: 'transform, opacity',
                  transitionDuration: '0.16s, 0.08s',
                  transitionTimingFunction: 'linear',
                }}
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

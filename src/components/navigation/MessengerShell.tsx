/**
 * The open widget panel: the corner-pinned, resizable surface holding the header bar, the Home and
 * Chat tabs, and the resize grip. Renders nothing while the store says closed; `WidgetRoot` is its
 * only caller.
 *
 * `useFocusTrap` traps keyboard focus inside the panel while it is open and restores it on close.
 * `useResize` lets a visitor drag or arrow-key resize the panel and remembers the chosen size per
 * tenant. `MessengerShell` renders the panel itself, including the header's screen-share control.
 *
 * The panel is a non-modal surface, not a dialog, so focus trapping and resizing are hand-rolled here
 * rather than reaching for a dialog primitive that would also lock the host page's own scrolling.
 */
import { Tabs } from '@base-ui/react/tabs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SHADOW } from '../../design-system/component-tokens';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import { readLocal, scopedKey, writeLocal } from '../../services/StorageService';
import type { MarketrixConfig, WidgetPosition, WidgetView } from '../../types';
import { createUserMessage } from '../../utils/chat';
import { backgroundGradient } from '../../utils/color';
import { focusablesIn } from '../../utils/dom';
import { logWarn } from '../../utils/log';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { getCorner, getPanelPositionStyle, getResizeGrip } from '../../utils/widgetPositioning';
import { Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { LiveDot } from '../base/LiveDot';
import { HeaderBar } from '../blocks/HeaderBar';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
import { ShellTabBar } from './ShellTabBar';

function activeElementIn(container: HTMLElement): HTMLElement | null {
  const root = container.getRootNode();
  return ((root instanceof ShadowRoot ? root.activeElement : document.activeElement) as HTMLElement) ?? null;
}

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  options: {
    onEscape: () => void;
    focusTargetRef?: React.RefObject<HTMLElement | null> | undefined;
  },
) {
  const previousActiveRef = useRef(false);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (previousActiveRef.current) {
        previouslyFocusedRef.current?.focus({ preventScroll: true });
        previouslyFocusedRef.current = null;
      }
      previousActiveRef.current = false;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    if (!previousActiveRef.current) {
      previouslyFocusedRef.current = activeElementIn(container);
    }
    previousActiveRef.current = true;

    const target = options.focusTargetRef?.current ?? focusablesIn(container)[0];
    target?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = activeElementIn(container);
      if (!current || !container.contains(current)) return;
      if (e.key === 'Escape') {
        options.onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = focusablesIn(container);
      if (focusables.length === 0) return;
      const idx = focusables.indexOf(current);
      if (idx === -1) return;
      if (e.shiftKey) {
        if (idx === 0) {
          e.preventDefault();
          focusables[focusables.length - 1]?.focus();
        }
      } else {
        if (idx === focusables.length - 1) {
          e.preventDefault();
          focusables[0]?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, containerRef, options.focusTargetRef, options.onEscape]);
}

interface Size {
  width: number;
  height: number;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 320;
const DEFAULT_SIZE: Size = { width: 360, height: 450 };
const KEYBOARD_RESIZE_STEP_PX = 16;

function clampSize({ width, height }: Size): Size {
  return {
    width: Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH),
    height: Math.min(Math.max(height, MIN_HEIGHT), Math.floor(window.innerHeight * 0.85)),
  };
}

function parsePx(value: string | undefined, fallback: number): number {
  const px = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(value ?? '');
  return px ? Number(px[1]) : fallback;
}

const STORAGE_KEY_NAME = 'marketrix_widget_size';

const WIDGET_VIEWS: readonly WidgetView[] = ['home', 'chat'];
const isWidgetView = (value: string): value is WidgetView => (WIDGET_VIEWS as readonly string[]).includes(value);

function isSize(value: unknown): value is Size {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['width'] === 'number' &&
    typeof (value as Record<string, unknown>)['height'] === 'number'
  );
}

function readStoredSize(storageKey: string): Size | null {
  try {
    const stored: unknown = JSON.parse(readLocal(storageKey) ?? 'null');
    return isSize(stored) ? clampSize(stored) : null;
  } catch (error) {
    logWarn('[useResize] Ignoring an unparseable stored size:', error);
    return null;
  }
}

export function useResize(
  settingsWidth: string | undefined,
  settingsHeight: string | undefined,
  position: WidgetPosition,
  config: MarketrixConfig,
  isPreviewMode: boolean,
) {
  const storageKey = scopedKey(STORAGE_KEY_NAME, config);
  const containerRef = useRef<HTMLDivElement>(null);
  const grip = useMemo(() => getResizeGrip(position), [position]);

  const [dimensions, setDimensions] = useState<Size>(
    () =>
      readStoredSize(storageKey) ??
      clampSize({
        width: parsePx(settingsWidth, DEFAULT_SIZE.width),
        height: parsePx(settingsHeight, DEFAULT_SIZE.height),
      }),
  );

  const dimsRef = useRef<Size>(dimensions);
  dimsRef.current = dimensions;
  const endDragRef = useRef<(() => void) | null>(null);

  useEffect(() => () => endDragRef.current?.(), []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPreviewMode) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = dimsRef.current.width;
      const startH = dimsRef.current.height;
      const { growX, growY, cursor } = grip;

      if (containerRef.current) {
        containerRef.current.dataset['resizing'] = 'true';
      }

      const onMove = (moveEvent: MouseEvent) => {
        const next = clampSize({
          width: startW + (moveEvent.clientX - startX) * growX,
          height: startH + (moveEvent.clientY - startY) * growY,
        });
        dimsRef.current = next;

        if (containerRef.current) {
          containerRef.current.style.width = `${next.width}px`;
          containerRef.current.style.height = `${next.height}px`;
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        endDragRef.current = null;

        if (containerRef.current) {
          delete containerRef.current.dataset['resizing'];
        }

        setDimensions({ ...dimsRef.current });
        writeLocal(storageKey, JSON.stringify(dimsRef.current));
      };

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      endDragRef.current = onUp;
    },
    [isPreviewMode, storageKey, grip],
  );

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isPreviewMode) return;
      const deltas: Record<string, Size> = {
        ArrowLeft: { width: -KEYBOARD_RESIZE_STEP_PX, height: 0 },
        ArrowRight: { width: KEYBOARD_RESIZE_STEP_PX, height: 0 },
        ArrowUp: { width: 0, height: -KEYBOARD_RESIZE_STEP_PX },
        ArrowDown: { width: 0, height: KEYBOARD_RESIZE_STEP_PX },
      };
      const delta = deltas[e.key];
      if (!delta) return;
      e.preventDefault();
      const next = clampSize({
        width: dimsRef.current.width + delta.width,
        height: dimsRef.current.height + delta.height,
      });
      dimsRef.current = next;
      setDimensions(next);
      writeLocal(storageKey, JSON.stringify(next));
    },
    [isPreviewMode, storageKey],
  );

  return {
    widthPx: `${dimensions.width}px`,
    heightPx: `${dimensions.height}px`,
    grip,
    onResizeStart: handleResizeStart,
    onResizeKeyDown: handleResizeKeyDown,
    containerRef,
  };
}

export const MessengerShell: React.FC = () => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { isOpen, activeView } = state;
  const { isPreviewMode } = config;

  const { widthPx, heightPx, grip, onResizeStart, onResizeKeyDown, containerRef } = useResize(
    config.widget_width,
    config.widget_height,
    config.widget_position,
    config,
    isPreviewMode,
  );

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const navDirection = activeView === 'chat' ? 'forward' : 'back';

  useFocusTrap(containerRef, isOpen, {
    onEscape: actions.closeWidget,
    focusTargetRef: activeView === 'chat' ? messageInputRef : undefined,
  });

  const panelPositionStyle = getPanelPositionStyle(config.widget_position);

  const [headerScreenSharing, setHeaderScreenSharing] = useState(false);
  const chatViewToggleScreenShareRef = useRef<(() => void) | null>(null);

  if (!isOpen) return null;

  const backgroundImage = backgroundGradient(config.widget_background_color);

  const { vertical, horizontal } = getCorner(config.widget_position);

  const handleChipClick = (action: SuggestedActionItem) => {
    actions.addMessage(createUserMessage(action.text, action.type, 'chip-message'));
    actions.setMode(action.type);
    void actions.messageDispatch(action.text, action.type, true);
  };

  const screenShareHandler =
    activeView === 'chat' && config.use_screenshare !== false
      ? () => chatViewToggleScreenShareRef.current?.()
      : undefined;

  return (
    <Stack
      ref={containerRef}
      position={isPreviewMode ? 'absolute' : 'fixed'}
      rounded='lg'
      border
      overflow='hidden'
      style={{
        zIndex: config.widget_position_z_index,
        backgroundImage,
        transformOrigin: `${vertical} ${horizontal}`,
        width: widthPx,
        height: heightPx,
        fontSize: '14px',
        ...panelPositionStyle,
        pointerEvents: 'auto',
        scrollbarWidth: 'thin',
        animation: 'messenger-entrance 300ms cubic-bezier(0, 1.2, 1, 1)',
        boxShadow: SHADOW.panel,
      }}
    >
      <HeaderBar
        title={config.widget_header}
        subtitle={config.widget_body}
        onClose={actions.closeWidget}
        controls={
          screenShareHandler && (
            <IconButton
              variant='ghost'
              size='sm'
              label={headerScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
              onClick={screenShareHandler}
            >
              {headerScreenSharing && <LiveDot style={{ position: 'absolute', top: '2px', right: '2px' }} />}
              <Icon name='screenShare' size={16} />
            </IconButton>
          )
        }
      />

      <Tabs.Root
        value={activeView}
        onValueChange={value => {
          if (typeof value === 'string' && isWidgetView(value)) actions.setActiveView(value);
        }}
        render={<Stack grow minHeight='0' />}
      >
        <Stack grow overflow='hidden' minHeight='0'>
          <Tabs.Panel
            value='home'
            data-view-transition
            data-direction={navDirection}
            style={{ width: '100%', height: '100%' }}
          >
            <HomeView onNavigateToChat={() => actions.setActiveView('chat')} onChipClick={handleChipClick} />
          </Tabs.Panel>
          <Tabs.Panel
            value='chat'
            data-view-transition
            data-direction={navDirection}
            style={{ width: '100%', height: '100%' }}
          >
            <ChatView
              onScreenSharingChange={setHeaderScreenSharing}
              toggleScreenShareRef={chatViewToggleScreenShareRef}
              messageInputRef={messageInputRef}
            />
          </Tabs.Panel>
        </Stack>

        <ShellTabBar />
      </Tabs.Root>

      {!isPreviewMode && (
        <div
          role='separator'
          aria-label={`Resize widget from ${grip.vertical} ${grip.horizontal}. Use arrow keys to resize.`}
          title='Drag to resize'
          tabIndex={0}
          style={{
            position: 'absolute',
            [grip.vertical]: 0,
            [grip.horizontal]: 0,
            width: '20px',
            height: '20px',
            padding: '4px',
            touchAction: 'none',
            zIndex: 10,
            display: 'flex',
            alignItems: grip.vertical === 'top' ? 'flex-start' : 'flex-end',
            justifyContent: grip.horizontal === 'left' ? 'flex-start' : 'flex-end',
            cursor: grip.cursor,
          }}
          onMouseDown={onResizeStart}
          onKeyDown={onResizeKeyDown}
        />
      )}
    </Stack>
  );
};

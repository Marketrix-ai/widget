/**
 * The open widget panel: the corner-pinned, resizable surface holding the header bar, the Home and
 * Chat tabs, and the resize grip.
 * `useFocusTrap` keeps focus inside the open panel, `useResize` drag- or key-resizes it and remembers the
 * size per tenant, and `MessengerShell` renders it. The panel is non-modal, so these are hand-rolled rather
 * than a dialog primitive that would inert the host page; only `WidgetRoot` locks host scrolling, and only on a
 * phone-width viewport.
 */
import { Tabs } from '@base-ui/react/tabs';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';

import { SHADOW } from '../../design-system/component-tokens';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import { DEFAULT_WIDGET_SETTINGS } from '../../sdk/contracts/widgetSettings';
import { activeScreenStream, stopScreenShare, subscribeScreenShare } from '../../services/ScreenShareService';
import { readLocalParsed, scopedKey, writeLocal } from '../../services/StorageService';
import { WIDGET_VIEWS } from '../../types';
import { backgroundGradient } from '../../utils/color';
import { focusablesIn } from '../../utils/dom';
import { getCorner, getPanelPositionStyle, getResizeGrip } from '../../utils/widgetPositioning';
import { Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { LiveDot } from '../base/LiveDot';
import { HeaderBar } from '../blocks/HeaderBar';
import { ScreenAccessDialog } from '../blocks/ScreenAccessDialog';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
import { ShellTabBar } from './ShellTabBar';

function activeElementIn(container: HTMLElement): HTMLElement | null {
  const root = container.getRootNode();
  const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
  return active instanceof HTMLElement ? active : null;
}

function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  options: {
    onEscape: () => void;
    focusTargetRef?: React.RefObject<HTMLElement | null> | undefined;
  },
) {
  const { onEscape, focusTargetRef } = options;
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

    const target = focusTargetRef?.current ?? focusablesIn(container)[0];
    target?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = activeElementIn(container);
      if (!current || !container.contains(current)) return;
      if (e.key === 'Escape') {
        onEscape();
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
  }, [isActive, containerRef, focusTargetRef, onEscape]);
}

const SizeSchema = z.object({ width: z.number(), height: z.number() });

type Size = z.infer<typeof SizeSchema>;

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 320;
const DEFAULT_SIZE: Size = {
  width: Number.parseInt(DEFAULT_WIDGET_SETTINGS.widget_width, 10),
  height: Number.parseInt(DEFAULT_WIDGET_SETTINGS.widget_height, 10),
};
const KEYBOARD_RESIZE_STEP_PX = 16;

function clampSize({ width, height }: Size): Size {
  return {
    width: Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH),
    height: Math.min(Math.max(height, MIN_HEIGHT), Math.floor(window.innerHeight * 0.85)),
  };
}

function parsePx(value: string, fallback: number): number {
  const px = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(value);
  return px ? Number(px[1]) : fallback;
}

const STORAGE_KEY_NAME = 'marketrix_widget_size';

function useResize() {
  const config = useWidgetConfig();
  const { isPreviewMode, widget_position: position } = config;
  const storageKey = scopedKey(STORAGE_KEY_NAME, config);
  const containerRef = useRef<HTMLDivElement>(null);
  const grip = useMemo(() => getResizeGrip(position), [position]);

  const [dimensions, setDimensions] = useState<Size>(() =>
    clampSize(
      readLocalParsed(storageKey, SizeSchema) ?? {
        width: parsePx(config.widget_width, DEFAULT_SIZE.width),
        height: parsePx(config.widget_height, DEFAULT_SIZE.height),
      },
    ),
  );

  const dimsRef = useRef<Size>(dimensions);
  dimsRef.current = dimensions;
  const endDragRef = useRef<(() => void) | null>(null);

  useEffect(() => () => endDragRef.current?.(), []);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPreviewMode) return;

      const handle = e.currentTarget;
      const { pointerId } = e;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = dimsRef.current.width;
      const startH = dimsRef.current.height;
      const { growX, growY, cursor } = grip;

      if (containerRef.current) {
        containerRef.current.dataset['resizing'] = 'true';
      }

      const onMove = (moveEvent: PointerEvent) => {
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
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        endDragRef.current = null;

        if (containerRef.current) {
          delete containerRef.current.dataset['resizing'];
        }

        setDimensions({ ...dimsRef.current });
        writeLocal(storageKey, dimsRef.current);
      };

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      handle.setPointerCapture(pointerId);
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
      endDragRef.current = onUp;
    },
    [isPreviewMode, storageKey, grip],
  );

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isPreviewMode) return;
      const deltas: Record<string, Size> = {
        ArrowLeft: { width: -KEYBOARD_RESIZE_STEP_PX * grip.growX, height: 0 },
        ArrowRight: { width: KEYBOARD_RESIZE_STEP_PX * grip.growX, height: 0 },
        ArrowUp: { width: 0, height: -KEYBOARD_RESIZE_STEP_PX * grip.growY },
        ArrowDown: { width: 0, height: KEYBOARD_RESIZE_STEP_PX * grip.growY },
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
      writeLocal(storageKey, next);
    },
    [isPreviewMode, storageKey, grip],
  );

  return {
    dimensions,
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

  const { dimensions, grip, onResizeStart, onResizeKeyDown, containerRef } = useResize();

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const navDirection = activeView === 'chat' ? 'forward' : 'back';

  useFocusTrap(containerRef, isOpen, {
    onEscape: actions.closeWidget,
    focusTargetRef: activeView === 'chat' ? messageInputRef : undefined,
  });

  const panelPositionStyle = getPanelPositionStyle(config.widget_position);

  const screenSharing = useSyncExternalStore(subscribeScreenShare, activeScreenStream) !== null;
  const [showScreenAccessDialog, setShowScreenAccessDialog] = useState(false);

  if (!isOpen) return null;

  const backgroundImage = backgroundGradient(config.widget_background_color);

  const { vertical, horizontal } = getCorner(config.widget_position);

  const screenShareHandler =
    activeView === 'chat' && config.use_screenshare !== false
      ? () => (screenSharing ? stopScreenShare() : setShowScreenAccessDialog(true))
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
        width: dimensions.width,
        height: dimensions.height,
        fontSize: DEFAULT_WIDGET_SETTINGS.widget_font_size,
        ...panelPositionStyle,
        pointerEvents: 'auto',
        scrollbarWidth: 'thin',
        boxShadow: SHADOW.panel,
      }}
    >
      {showScreenAccessDialog && (
        <ScreenAccessDialog
          onClose={() => setShowScreenAccessDialog(false)}
          onConfirm={() => {
            setShowScreenAccessDialog(false);
            void actions.allowScreenAccess();
          }}
          finalFocusRef={messageInputRef}
        />
      )}

      <HeaderBar
        title={config.widget_header}
        subtitle={config.widget_body}
        onClose={actions.closeWidget}
        controls={
          screenShareHandler && (
            <IconButton
              variant='ghost'
              size='sm'
              label={screenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
              onClick={screenShareHandler}
            >
              {screenSharing && <LiveDot style={{ position: 'absolute', top: '2px', right: '2px' }} />}
              <Icon name='screenShare' size={16} />
            </IconButton>
          )
        }
      />

      <Tabs.Root
        value={activeView}
        onValueChange={value => {
          const view = WIDGET_VIEWS.find(candidate => candidate === value);
          if (view) actions.setActiveView(view);
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
            <HomeView />
          </Tabs.Panel>
          <Tabs.Panel
            value='chat'
            data-view-transition
            data-direction={navDirection}
            style={{ width: '100%', height: '100%' }}
          >
            <ChatView messageInputRef={messageInputRef} />
          </Tabs.Panel>
        </Stack>

        <ShellTabBar />
      </Tabs.Root>

      {!isPreviewMode && (
        <div
          role='separator'
          aria-label={`Resize widget from ${grip.vertical} ${grip.horizontal}. Use arrow keys to resize.`}
          aria-orientation='vertical'
          aria-valuenow={dimensions.width}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuetext={`${dimensions.width} by ${dimensions.height} pixels`}
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
          onPointerDown={onResizeStart}
          onKeyDown={onResizeKeyDown}
        />
      )}
    </Stack>
  );
};

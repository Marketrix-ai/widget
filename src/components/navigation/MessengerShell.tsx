/**
 * The open widget panel: the corner-pinned, resizable surface carrying the header bar, the Home/Chat tab views and
 * the resize grip. `MessengerShell` renders null while the store says closed; `WidgetRoot` is its only caller.
 *
 * Geometry comes from the tenant config, never from props. `useResize` owns the persisted size, keyed by
 * `config` via the shared `scopedKey` so two tenants on one host page cannot share a stored size;
 * `getPanelPositionStyle` pins the panel to the configured corner and `getCorner` supplies the matching
 * `transformOrigin`, so the entrance animation scales out of the anchored corner instead of the panel's centre.
 * Preview mode (the dashboard embed) positions `absolute` rather than `fixed` and drops the 20px corner resize
 * grip — a labelled `separator` with `touchAction: none`, so a drag is not hijacked by scrolling — since it
 * lives inside a page element. `useFocusTrap` closes on Escape and, on the chat view, lands focus in the
 * composer through `messageInputRef` — the same ref `ChatView` attaches to its textarea.
 *
 * The screen-share control sits in the header, but its machinery lives in `ChatView`'s `useScreenShare`:
 * `chatViewToggleScreenShareRef` is what that hook's `useImperativeHandle` fills, and `onScreenSharingChange`
 * mirrors sharing state back up for the button's label and live dot. That ref and `headerScreenSharing` are
 * declared ABOVE the closed-panel early return, since a hook below a conditional return changes hook order between
 * renders. `handleChipClick` treats a home-screen suggestion as a typed message, dispatching it under the chip's
 * mode; `navDirection` is what `index.css` reads off `data-direction` to slide the incoming view, since Base UI
 * unmounts a deselected `Tabs.Panel` and the selected one remounts and replays that slide on each switch.
 *
 * `useFocusTrap` (below) is hand-rolled on purpose: this panel is a NON-modal surface, not a Dialog, and Base UI
 * exposes no standalone focus-trap or scroll-lock — reaching either by making the panel a Dialog would inert the
 * customer's host page and mutate its `<html>`/`<body>`, which an embedded widget must not do. While `isActive`,
 * focus starts inside `containerRef`, Tab cycles within it, Escape calls `onEscape`, and on deactivation focus
 * returns to whatever held it before; the tabbable candidates come from `utils/dom`'s shared `focusablesIn`, the
 * same filter `keySimulation`'s Tab simulation uses, so the widget's own tab order and the host page's can't
 * re-diverge. Inside the widget's closed shadow root `document.activeElement` retargets to the HOST, never naming
 * an element of the widget's own tree; `activeElementIn` reads through `container.getRootNode()` instead and is
 * the ONE home for that retargeting — eslint's `no-restricted-properties` bans the bare read everywhere else.
 * Both key arms bail unless focus is currently inside the container, since the listener sits on `document` ahead
 * of host-page handlers and an unguarded Escape would close the widget mid-typing. The effect deliberately
 * depends on `options?.focusTargetRef`/`options?.onEscape`, not `options` itself: the caller passes a fresh
 * object literal every render, so depending on the whole object would re-run (and re-focus) the trap on every
 * render instead of only when the callback or target actually changes.
 *
 * `useResize` returns `widthPx`/`heightPx`, the `grip` its handle renders from, the pointer handlers for
 * that handle (from the shared `usePointerTrack` — see its header for the idle/tracking/committing
 * skeleton), and `containerRef` for the element being sized. The opening size is this tenant's stored one
 * if there is one, else the dashboard's `widget_width`/`widget_height` — both through `clampSize`, so a
 * setting outside the drag range lands on the same bounds a drag has. `parsePx` accepts a bare px length
 * only, since `rem`/`em`/`%` can't be resolved without layout. `thresholdPx: 0` makes every pointerdown on
 * the grip an immediate resize (`onTrackStart` stamps `data-resizing` and the drag cursor); pointer
 * capture ties the gesture to the grip element itself, so a resize needs no unmount-cleanup of its own —
 * capture releases automatically if the node is torn down mid-drag, unlike the `document`-level
 * `mousemove`/`mouseup` pair this replaced, which needed hand-written removal. `readStoredSize` parses
 * the tenant-scoped `marketrix_widget_size_<scope>` entry (keyed through the shared `scopedKey`, like its two `readLocal`/
 * `writeLocal` siblings), warning-then-defaulting on anything unparseable since corrupted host-page localStorage
 * must not leave the panel unsizable. `clampSize` bounds width to MIN_WIDTH..MAX_WIDTH, height to MIN_HEIGHT..85%
 * of the viewport, measured at call time so a resize re-clamps on the next drag. The grip is on the corner
 * diagonally opposite the pinned one (`getResizeGrip`); `growX`/`growY` turn pointer delta into size delta for
 * whichever corner that is. During a drag the new size is written straight to the element's inline style and
 * held in `dimsRef` (`useLatest`) — React state commits once, on release, so pointer motion never re-renders
 * the tree. `data-resizing` keys `index.css`'s CSS transition off. Preview mode disables the track (`disabled`),
 * so it never writes a visitor size. The grip is also a focusable `role='separator'`
 * (`tabIndex=0`): `onResizeKeyDown` steps width/height by `KEYBOARD_RESIZE_STEP_PX` per arrow key, through
 * the same `clampSize`/`writeLocal` path as a drag, so a keyboard-only visitor can resize the panel too.
 */
import { Tabs } from '@base-ui/react/tabs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SHADOW } from '../../design-system/component-tokens';
import { useLatest } from '../../hooks/useLatest';
import { usePointerTrack } from '../../hooks/usePointerTrack';
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
  options?: {
    onEscape?: () => void;
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

    const target = options?.focusTargetRef?.current ?? focusablesIn(container)[0];
    target?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = activeElementIn(container);
      if (!current || !container.contains(current)) return;
      if (e.key === 'Escape') {
        options?.onEscape?.();
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
  }, [isActive, containerRef, options?.focusTargetRef, options?.onEscape]);
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

  const dimsRef = useLatest(dimensions);
  const startSizeRef = useRef<Size>(dimensions);

  const clearResizeChrome = () => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (containerRef.current) delete containerRef.current.dataset['resizing'];
  };

  const track = usePointerTrack({
    disabled: isPreviewMode,
    thresholdPx: 0,
    onTrackStart: () => {
      startSizeRef.current = dimsRef.current;
      if (containerRef.current) containerRef.current.dataset['resizing'] = 'true';
      document.body.style.cursor = grip.cursor;
      document.body.style.userSelect = 'none';
    },
    onTrack: (dx, dy) => {
      const next = clampSize({
        width: startSizeRef.current.width + dx * grip.growX,
        height: startSizeRef.current.height + dy * grip.growY,
      });
      dimsRef.current = next;
      if (containerRef.current) {
        containerRef.current.style.width = `${next.width}px`;
        containerRef.current.style.height = `${next.height}px`;
      }
    },
    onRelease: (_dx, _dy, _event, commit) => {
      clearResizeChrome();
      setDimensions(dimsRef.current);
      writeLocal(storageKey, JSON.stringify(dimsRef.current));
      commit();
    },
    onCancel: clearResizeChrome,
  });

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
    [isPreviewMode, storageKey, dimsRef],
  );

  return {
    widthPx: `${dimensions.width}px`,
    heightPx: `${dimensions.height}px`,
    grip,
    onPointerDown: track.onPointerDown,
    onPointerMove: track.onPointerMove,
    onPointerUp: track.onPointerUp,
    onPointerCancel: track.onPointerCancel,
    onResizeKeyDown: handleResizeKeyDown,
    containerRef,
  };
}

export const MessengerShell: React.FC = () => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { isOpen, activeView } = state;
  const { isPreviewMode } = config;

  const {
    widthPx,
    heightPx,
    grip,
    onPointerDown: onResizePointerDown,
    onPointerMove: onResizePointerMove,
    onPointerUp: onResizePointerUp,
    onPointerCancel: onResizePointerCancel,
    onResizeKeyDown,
    containerRef,
  } = useResize(config.widget_width, config.widget_height, config.widget_position, config, isPreviewMode);

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
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerCancel}
          onKeyDown={onResizeKeyDown}
        />
      )}
    </Stack>
  );
};

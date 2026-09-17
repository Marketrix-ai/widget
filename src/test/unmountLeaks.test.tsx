/**
 * Proves the widget leaves nothing behind on `unmountWidget()`/a React-tree unmount, across the two
 * teardown paths a customer's page actually exercises.
 *
 * `installRegistry` tracks registrations only on `window` and `document` — the two `EventTarget`s that
 * outlive the widget's own removed subtree. A listener on a widget-local node (the FAB wrapper, the
 * video element) is reclaimed by garbage collection together with that node once
 * `active.container.remove()` runs, same as any framework's delegated event listeners; wrapping
 * `EventTarget.prototype` instead measures that harmless case as a false positive (the widget's own
 * React root leaves hundreds "open" purely because its container is never detached in a
 * `render()`/`unmount()` test, without ever leaking in a real page). `window`/`document` never go away,
 * so a registration there that survives teardown is the one shape of leak this lens cares about — which
 * is exactly where both fixes below live — except React's own `document`-level `selectionchange`
 * listener (`FRAMEWORK_OWNED_TYPES`): React attaches it the first time ANY root ever mounts
 * (`react-dom-client.js`'s `listenToAllSupportedEvents`) and never removes it, by design, shared across
 * every root a page ever creates and identical in a real browser — React's own standing registration,
 * not a per-mount leak this widget's code owns. `setInterval`/
 * `clearInterval` and `setTimeout`/`clearTimeout` are tracked the same way, net outstanding once a
 * same-tick zero-delay timer (e.g. jsdom's own `storage`-event dispatch) has had a turn to fire — a
 * timer that FIRES is not a leak, only one still pending when checked is.
 *
 * Two independent teardown paths are exercised, because `renderWidget`'s `WidgetRoot` (component-tree
 * hygiene: FAB drag, resize grip) and `index.tsx`'s `unmountWidget` (singleton teardown: `streamClient`,
 * `rrwebSessionRecorder`, `stopScreenShare`, `showModeService`) are reached by different call paths —
 * `unmountWidget` calls `active.instance.unmount()` for the former and its own explicit calls for the
 * latter, so a bug in either is invisible to a test that only exercises the other:
 *
 * 1. `describe('component-tree unmount')` renders in production mode (the resize grip and FAB drag are
 *    both disabled in preview mode, so a preview-mode render couldn't reach either fixed leak) and
 *    interrupts a drag/resize mid-gesture — never waiting for the natural `mouseup`/`transitionend` —
 *    since that is the exact case a tenant page's `unmountWidget` call cannot control, and pins two
 *    fixed leaks exactly this way: a `WidgetFab` snap left mid-air (a stale fallback `setTimeout`
 *    surviving the wrapper, calling `onPositionCommit` and a state setter after unmount) and a
 *    `MessengerShell` resize left mid-drag (a stale `document` `mousemove`/`mouseup` pair).
 * 2. `describe('unmountWidget singleton teardown')` calls `showModeService.showToolAction` directly to
 *    put its host-page overlay (listeners on `document`, a `setInterval`, two nodes on `document.body`
 *    OUTSIDE the shadow root `active.instance.unmount()` cannot reach) into the exact leaking state,
 *    then calls the real `unmountWidget` and asserts it is gone — the fix this file pins.
 *
 * A second mount/unmount cycle in each describe block proves idempotence: the screen-share
 * non-idempotency bug (`ScreenShareService.test.ts`'s header) is the precedent for why one cycle is not
 * proof.
 */
import { fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { unmountWidget } from '../index';
import { chatSessionManager } from '../services/ChatSessionManager';
import { showModeService } from '../services/ShowModeService';
import { writeChatSnapshot } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import { renderWidget } from '../test/renderWidget';

interface Registry {
  openListeners: number;
  openIntervals: number;
  openTimeouts: number;
  restore: () => void;
}

const FRAMEWORK_OWNED_TYPES = new Set(['selectionchange']);

function patchTarget(target: Window | Document, open: { type: string; listener: unknown }[]): () => void {
  const realAdd = target.addEventListener.bind(target);
  const realRemove = target.removeEventListener.bind(target);
  target.addEventListener = ((type: string, listener: unknown, options?: unknown) => {
    if (!FRAMEWORK_OWNED_TYPES.has(type)) open.push({ type, listener });
    return realAdd(type, listener as EventListenerOrEventListenerObject, options as AddEventListenerOptions);
  }) as typeof target.addEventListener;
  target.removeEventListener = ((type: string, listener: unknown, options?: unknown) => {
    const idx = open.findIndex(e => e.type === type && e.listener === listener);
    if (idx !== -1) open.splice(idx, 1);
    return realRemove(type, listener as EventListenerOrEventListenerObject, options as EventListenerOptions);
  }) as typeof target.removeEventListener;
  return () => {
    target.addEventListener = realAdd;
    target.removeEventListener = realRemove;
  };
}

function installRegistry(): Registry {
  const open: { type: string; listener: unknown }[] = [];
  const restoreWindow = patchTarget(window, open);
  const restoreDocument = patchTarget(document, open);

  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  const liveIntervals = new Set<ReturnType<typeof setInterval>>();
  globalThis.setInterval = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
    const id = realSetInterval(fn as never, ms, ...rest);
    liveIntervals.add(id);
    return id;
  }) as unknown as typeof setInterval;
  globalThis.clearInterval = ((id?: Parameters<typeof clearInterval>[0]) => {
    if (id !== undefined) liveIntervals.delete(id as ReturnType<typeof setInterval>);
    return realClearInterval(id as never);
  }) as typeof clearInterval;

  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const liveTimeouts = new Set<ReturnType<typeof setTimeout>>();
  globalThis.setTimeout = ((fn: (...fnArgs: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
    // A timeout that FIRES is not a leak — only one still pending when checked is. jsdom schedules its
    // own zero-delay timers internally (a `localStorage.setItem` dispatches its `storage` event this
    // way), so without this a widget-caused write racing the assertion would read as a false leak.
    const box: { id?: ReturnType<typeof setTimeout> } = {};
    box.id = realSetTimeout(
      (...fnArgs: unknown[]) => {
        liveTimeouts.delete(box.id as ReturnType<typeof setTimeout>);
        fn(...fnArgs);
      },
      ms,
      ...rest,
    ) as ReturnType<typeof setTimeout>;
    liveTimeouts.add(box.id);
    return box.id;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id?: Parameters<typeof clearTimeout>[0]) => {
    if (id !== undefined) liveTimeouts.delete(id as ReturnType<typeof setTimeout>);
    return realClearTimeout(id as never);
  }) as typeof clearTimeout;

  return {
    get openListeners() {
      return open.length;
    },
    get openIntervals() {
      return liveIntervals.size;
    },
    get openTimeouts() {
      return liveTimeouts.size;
    },
    restore: () => {
      restoreWindow();
      restoreDocument();
      globalThis.setInterval = realSetInterval;
      globalThis.clearInterval = realClearInterval;
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    },
  };
}

describe('component-tree unmount releases everything WidgetRoot registered on window/document', () => {
  let registry: Registry;

  beforeEach(() => {
    // Production mode persists `{currentMode, isOpen}` to localStorage on every UI-state change
    // (`PersistBridge`) and restores it on the next mount (`InitBridge`) — cleared here so one test's
    // `openWidget()` doesn't leave the next test starting from an already-open panel.
    localStorage.clear();
    vi.spyOn(chatSessionManager, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'disconnect').mockImplementation(() => {});
    // `renderWidget` never calls `storageService.setConfig`, so `messageDispatch`'s credentialed path
    // reports "Config not loaded or incomplete" and returns before touching the network — this guard
    // stays as a backstop against a future test change accidentally reaching a real `fetch`.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network disabled in this test'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registry = installRegistry();
  });

  afterEach(() => {
    registry.restore();
    vi.restoreAllMocks();
  });

  const mountDriveAndTearDown = async (): Promise<{
    listenersBefore: number;
    listenersAfter: number;
    timeoutsAfter: number;
  }> => {
    // Scoped to `result.container`, never the shared `screen` (bound to the whole document) — this
    // helper runs twice per idempotence test and a leftover container from a prior render would
    // otherwise make an unscoped query ambiguous.
    // `storageService` caches its context in memory, not just in `localStorage` (`StorageService.ts`'s
    // `private context`) — clearing storage alone leaves a prior cycle's `isOpen: true` cached, so the
    // next mount reads back into an already-open panel instead of the closed one a fresh page load gets.
    localStorage.clear();
    writeChatSnapshot({ messages: [], currentMode: 'tell', isOpen: false });
    const listenersBefore = registry.openListeners;
    const result = renderWidget({}, { previewMode: false });
    const scope = within(result.container);
    await waitFor(() => expect(streamClient.connect).toHaveBeenCalled());

    fireEvent.click(scope.getByRole('button', { name: /open/i }));
    fireEvent.click(await scope.findByRole('tab', { name: 'Chat' }));

    const composer = result.container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: 'hello from a leak test' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(scope.getByText('hello from a leak test')).toBeInTheDocument());

    // Interrupt a FAB drag mid-flight: a real snap animates for SNAP_DURATION_MS and only then fires
    // `transitionend` — closing the widget before that must not leave the fallback timer behind.
    const fab = result.container.querySelector('.mtx-fab-trigger') as HTMLElement;
    // jsdom has no Pointer Events capture API — `useDragSnap`'s handlers call it unconditionally.
    fab.setPointerCapture = () => {};
    fab.releasePointerCapture = () => {};
    fireEvent.pointerDown(fab, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(fab, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(fab, { pointerId: 1, clientX: 40, clientY: 40 });

    // Interrupt a resize drag mid-flight: a real drag ends on `mouseup`, which this deliberately never
    // fires — proving the fix releases the pair on unmount, not just on a completed gesture.
    const grip = result.container.querySelector('[role="separator"]') as HTMLElement | null;
    if (grip) {
      fireEvent.mouseDown(grip, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 120, clientY: 130 });
    }

    result.unmount();
    // Lets a same-tick zero-delay timer (jsdom's own storage-event dispatch, harmless) actually fire
    // before reading `openTimeouts`, so only a timer still pending — a real leak — counts.
    await new Promise(resolve => setTimeout(resolve, 0));
    return { listenersBefore, listenersAfter: registry.openListeners, timeoutsAfter: registry.openTimeouts };
  };

  it('nets window/document listeners to zero and clears the FAB snap fallback timer, across a drag and a resize interrupted mid-gesture', async () => {
    const { listenersBefore, listenersAfter, timeoutsAfter } = await mountDriveAndTearDown();
    expect(listenersAfter).toBe(listenersBefore);
    expect(timeoutsAfter).toBe(0);
  });

  it('is idempotent across a second mount/unmount cycle', async () => {
    const first = await mountDriveAndTearDown();
    expect(first.listenersAfter).toBe(first.listenersBefore);
    expect(first.timeoutsAfter).toBe(0);
    const second = await mountDriveAndTearDown();
    expect(second.listenersAfter).toBe(second.listenersBefore);
    expect(second.timeoutsAfter).toBe(0);
  });
});

describe('unmountWidget releases the show-mode overlay it does not own via the React tree', () => {
  afterEach(() => {
    showModeService.cleanup();
    document.getElementById('marketrix-show-popup')?.remove();
    document.getElementById('marketrix-show-highlight')?.remove();
  });

  const activateShowModeOverlay = (): Registry => {
    const registry = installRegistry();
    const target = document.createElement('button');
    target.scrollIntoView = () => {};
    document.body.appendChild(target);
    // `cleanup()` rejects the pending promise (`unmountWidget` tears this down mid-flight, same as a
    // real cancellation) — caught here since nothing in this test awaits the tool call's outcome.
    showModeService
      .showToolAction({
        element: target,
        explanation: 'Click this to continue',
        browserToolName: 'click_element',
        isClickAction: true,
      })
      .catch(() => {});
    return registry;
  };

  it('removes the overlay DOM, its document listeners and its visibility interval', () => {
    const registry = activateShowModeOverlay();
    expect(document.getElementById('marketrix-show-popup')).not.toBeNull();
    expect(document.getElementById('marketrix-show-highlight')).not.toBeNull();
    expect(registry.openListeners).toBeGreaterThan(0);
    expect(registry.openIntervals).toBeGreaterThan(0);

    unmountWidget();

    expect(document.getElementById('marketrix-show-popup')).toBeNull();
    expect(document.getElementById('marketrix-show-highlight')).toBeNull();
    expect(registry.openListeners).toBe(0);
    expect(registry.openIntervals).toBe(0);
    registry.restore();
  });

  it('is idempotent across a second activate/unmount cycle', () => {
    const first = activateShowModeOverlay();
    unmountWidget();
    expect(first.openListeners).toBe(0);
    expect(first.openIntervals).toBe(0);
    first.restore();

    const second = activateShowModeOverlay();
    unmountWidget();
    expect(second.openListeners).toBe(0);
    expect(second.openIntervals).toBe(0);
    second.restore();
  });
});

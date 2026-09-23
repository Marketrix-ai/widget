/**
 * Proves the widget leaves nothing behind on `unmountWidget()`/a React-tree unmount: no leaked
 * `window`/`document` listeners, timers, or DOM nodes, across component-tree teardown (FAB drag, resize
 * grip interrupted mid-gesture), singleton teardown (show-mode overlay, streamClient, screen share), and
 * an active rrweb session recording. Each case also proves idempotence across a second mount/unmount.
 */
import { record } from '@rrweb/record';
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { initWidget, unmountWidget } from '../index';
import * as chatSession from '../services/chatSession';
import { showModeService } from '../services/ShowModeService';
import { writeChatSnapshot } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import * as WidgetService from '../services/WidgetService';
import { credentialedConfig } from '../test/fixtures';
import { renderWidget } from '../test/renderWidget';
import { mocked, mockSdkModule, restoreModuleAfterAll } from '../test/vi-compat';

vi.mock('@rrweb/record', () => ({ record: vi.fn(() => vi.fn()) }));
vi.mock('../sdk', () => mockSdkModule({ widgetMessagePost: vi.fn().mockResolvedValue({ success: true }) }));
restoreModuleAfterAll('../sdk', () => import('../sdk/index.ts?real'));

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
    localStorage.clear();
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'disconnect').mockImplementation(() => {});
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

    const fab = result.container.querySelector('.mtx-fab-trigger') as HTMLElement;
    fab.setPointerCapture = () => {};
    fab.releasePointerCapture = () => {};
    fireEvent.pointerDown(fab, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(fab, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(fab, { pointerId: 1, clientX: 40, clientY: 40 });

    const grip = result.container.querySelector('[role="separator"]') as HTMLElement | null;
    if (grip) {
      fireEvent.mouseDown(grip, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 120, clientY: 130 });
    }

    result.unmount();
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
    showModeService
      .showToolAction({
        element: target,
        index: 0,
        explanation: 'Click this to continue',
        browserToolName: 'click_element',
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

describe('unmountWidget stops an active rrweb session recording started by the real init flow', () => {
  afterEach(() => {
    unmountWidget();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    window.__mtx = undefined;
  });

  it("calls the recorder's rrweb teardown function on a mid-stream unmount, not just its own internal flag", async () => {
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockResolvedValue(
      credentialedConfig({ widget_recording: true, mtxApp: 1 }),
    );
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
    const stopRecording = vi.fn();
    mocked(record).mockReturnValue(stopRecording);

    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(() => initWidget({ mtxId: 'rec-1', mtxKey: 'key', mtxApiHost: 'https://api.test' }, container));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));

    unmountWidget();

    expect(stopRecording).toHaveBeenCalledTimes(1);
  });
});

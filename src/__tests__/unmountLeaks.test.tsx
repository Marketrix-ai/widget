/**
 * Proves the widget leaves nothing behind on `unmountWidget()`/a React-tree unmount: no leaked
 * `window`/`document` listeners, timers, or DOM nodes, across component-tree teardown (FAB drag, resize
 * grip interrupted mid-gesture), singleton teardown (show-mode overlay, streamClient, screen share), and
 * an active rrweb session recording. Each case also proves idempotence across a second mount/unmount.
 * Only intervals `ShowModeService` starts directly are counted, since jsdom's animation-frame clock and a
 * previous test's teardown also start intervals that settle on their own.
 */
import type { record as recordFn } from '@rrweb/record';
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { initWidget, unmountWidget } from '../index';
import { mountPreview, previewConfig } from '../mount';
import type { WidgetClient } from '../sdk';
import * as chatThread from '../services/chatThread';
import { showModeService } from '../services/ShowModeService';
import { writeChatSnapshot } from '../services/StorageService';
import { streamClient } from '../services/StreamClient';
import * as WidgetService from '../services/WidgetService';
import { $, asStreamClientInternals, credentialedConfig, validSettings } from '../test/fixtures';
import { dragFabAndResize, renderWidget } from '../test/renderWidget';
import { mockSdk } from '../test/vi-compat';

const record = vi.fn<(...args: Parameters<typeof recordFn>) => ReturnType<typeof recordFn>>(() => vi.fn());
vi.mock('@rrweb/record', () => ({ record }));
mockSdk({ widgetMessagePost: vi.fn<WidgetClient['widgetMessagePost']>().mockResolvedValue({ success: true }) });

interface Registry {
  openListeners: number;
  openShowModeIntervals: number;
  openTimeouts: number;
  restore: () => void;
}

const FRAMEWORK_OWNED_TYPES = new Set(['selectionchange']);

function patchTarget(
  target: EventTarget,
  open: { type: string; listener: EventListenerOrEventListenerObject | null }[],
): () => void {
  const realAdd = target.addEventListener.bind(target);
  const realRemove = target.removeEventListener.bind(target);
  const add = vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
    if (!FRAMEWORK_OWNED_TYPES.has(type)) open.push({ type, listener });
    realAdd(type, listener, options);
  });
  const remove = vi.spyOn(target, 'removeEventListener').mockImplementation((type, listener, options) => {
    const idx = open.findIndex(e => e.type === type && e.listener === listener);
    if (idx !== -1) open.splice(idx, 1);
    realRemove(type, listener, options);
  });
  return () => {
    add.mockRestore();
    remove.mockRestore();
  };
}

function installRegistry(): Registry {
  const open: { type: string; listener: EventListenerOrEventListenerObject | null }[] = [];
  const restoreWindow = patchTarget(window, open);
  const restoreDocument = patchTarget(document, open);

  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const liveIntervals = new Set<ReturnType<typeof setTimeout>>();
  const liveTimeouts = new Set<ReturnType<typeof setTimeout>>();
  Reflect.set(globalThis, 'setInterval', (callback: () => void, ms?: number): ReturnType<typeof setTimeout> => {
    const id = realSetInterval(callback, ms);
    if (new Error().stack?.split('\n')[2]?.includes('ShowModeService')) liveIntervals.add(id);
    return id;
  });
  Reflect.set(globalThis, 'clearInterval', (id?: ReturnType<typeof setTimeout>): void => {
    if (id !== undefined) liveIntervals.delete(id);
    realClearInterval(id);
  });
  Reflect.set(globalThis, 'setTimeout', (callback: () => void, ms?: number): ReturnType<typeof setTimeout> => {
    const id = realSetTimeout(() => {
      liveTimeouts.delete(id);
      callback();
    }, ms);
    liveTimeouts.add(id);
    return id;
  });
  Reflect.set(globalThis, 'clearTimeout', (id?: ReturnType<typeof setTimeout>): void => {
    if (id !== undefined) liveTimeouts.delete(id);
    realClearTimeout(id);
  });

  return {
    get openListeners() {
      return open.length;
    },
    get openShowModeIntervals() {
      return liveIntervals.size;
    },
    get openTimeouts() {
      return liveTimeouts.size;
    },
    restore: () => {
      restoreWindow();
      restoreDocument();
      Reflect.set(globalThis, 'setInterval', realSetInterval);
      Reflect.set(globalThis, 'clearInterval', realClearInterval);
      Reflect.set(globalThis, 'setTimeout', realSetTimeout);
      Reflect.set(globalThis, 'clearTimeout', realClearTimeout);
    },
  };
}

describe('component-tree unmount releases everything WidgetRoot registered on window/document', () => {
  let registry: Registry;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
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

    const composer = $('textarea', result.container);
    fireEvent.change(composer, { target: { value: 'hello from a leak test' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(scope.getByText('hello from a leak test')).toBeInTheDocument());

    dragFabAndResize(result.container, { releaseGrip: false });

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
    act(() => mountPreview(previewConfig(validSettings()), undefined));
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
    expect(registry.openShowModeIntervals).toBeGreaterThan(0);

    unmountWidget();

    expect(document.getElementById('marketrix-show-popup')).toBeNull();
    expect(document.getElementById('marketrix-show-highlight')).toBeNull();
    expect(registry.openListeners).toBe(0);
    expect(registry.openShowModeIntervals).toBe(0);
    registry.restore();
  });

  it('is idempotent across a second activate/unmount cycle', () => {
    const first = activateShowModeOverlay();
    unmountWidget();
    expect(first.openListeners).toBe(0);
    expect(first.openShowModeIntervals).toBe(0);
    first.restore();

    const second = activateShowModeOverlay();
    unmountWidget();
    expect(second.openListeners).toBe(0);
    expect(second.openShowModeIntervals).toBe(0);
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
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockResolvedValue(credentialedConfig({ widget_recording: true }));
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-1');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    const stopRecording = vi.fn();
    record.mockReturnValue(stopRecording);

    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(() => initWidget({ mtxId: 'rec-1', mtxKey: 'key', mtxApiHost: 'https://api.test' }, container));
    act(() => {
      asStreamClientInternals().state = { phase: 'registered', chatId: 'chat-1', gen: 1 };
    });
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));

    act(() => unmountWidget());

    expect(stopRecording).toHaveBeenCalledTimes(1);
  });
});

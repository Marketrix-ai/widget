/**
 * With two snaps in flight, `useDragSnap` commits the corner the widget is animating to, not the one
 * it left. `onPositionCommit` is the caller's door to persistence — in production `WidgetRoot` calls
 * `writeLocal` from it exactly once per drop, never per pointermove, and a later mount reads the same
 * key back through `StorageService`'s `readLocal`/`scopedKey`, so a stored corner round-trips. A window
 * resize re-derives the launcher's anchor (and therefore re-clamps it inside the new viewport) because
 * `pixelPositionStyle` is computed from `window.innerWidth`/`innerHeight` at render time and the resize
 * listener only forces that re-render — there is no separate clamp step to duplicate. `renderDragSnap`
 * is the one hook-under-test setup every case below shares: a measured 56x56 wrapper (`wrapperFor`) at
 * the bottom-right corner, wired to whatever `onPositionCommit` a case needs. The resting-anchor case
 * renders the whole widget instead, to pin the actual CSS the launcher ends up with.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { createRef } from 'react';

import * as chatSession from '../../../services/chatSession';
import { readLocal, scopedKey, writeLocal } from '../../../services/StorageService';
import { streamClient } from '../../../services/StreamClient';
import { resetDom } from '../../../test/preload';
import { renderWidget } from '../../../test/renderWidget';
import type { WidgetPosition } from '../../../types';
import { useDragSnap } from '../WidgetFab';

const wrapperFor = () => {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: 56, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: 56, configurable: true });
  document.body.appendChild(el);
  return el;
};

const dragTo = (handlers: ReturnType<typeof useDragSnap>, x: number, y: number) => {
  const base = { pointerId: 1, currentTarget: { setPointerCapture: () => {}, releasePointerCapture: () => {} } };
  act(() => handlers.onPointerDown({ ...base, clientX: 0, clientY: 0 } as never));
  act(() => handlers.onPointerMove({ ...base, clientX: x, clientY: y } as never));
  act(() => handlers.onPointerUp({ ...base, clientX: x, clientY: y } as never));
};

const renderDragSnap = (onPositionCommit: (position: WidgetPosition) => void) => {
  const wrapperRef = createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
  (wrapperRef as { current: HTMLDivElement }).current = wrapperFor();
  return renderHook(() =>
    useDragSnap({ position: 'bottom_right', onPositionCommit, isPreviewMode: false, wrapperRef }),
  );
};

describe('two snaps in flight', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    resetDom();
  });

  it('commits the corner the widget is animating to, not the one it left', () => {
    const committed: WidgetPosition[] = [];
    const { result } = renderDragSnap(corner => committed.push(corner));

    dragTo(result.current, -window.innerWidth, 0);
    dragTo(result.current, 0, -window.innerHeight);
    act(() => vi.advanceTimersByTime(2000));

    expect(committed.length).toBeGreaterThan(0);
    expect(committed[committed.length - 1]).toBe('top_right');
  });
});

describe('a drop writes the position key exactly once, and it round-trips', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    resetDom();
  });

  it('calls StorageService once per drop and reads the same corner back', () => {
    const config = { mtxId: 'drag-storage-test' };
    const key = scopedKey('marketrix_widget_position', config);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderDragSnap(corner => writeLocal(key, corner));

    dragTo(result.current, -window.innerWidth, -window.innerHeight);
    act(() => vi.advanceTimersByTime(2000));

    expect(setItemSpy.mock.calls.filter(([storedKey]) => storedKey === key)).toHaveLength(1);
    expect(readLocal(key)).toBe('top_left');
    setItemSpy.mockRestore();
  });
});

describe('a viewport resize re-derives the launcher anchor', () => {
  afterEach(() => resetDom());

  it('re-anchors to the new viewport instead of keeping the stale one', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { result } = renderDragSnap(() => {});
    const before = result.current.pixelPositionStyle;
    const onResize = addSpy.mock.calls.find(([type]) => type === 'resize')?.[1] as () => void;

    Object.defineProperty(window, 'innerWidth', { value: window.innerWidth + 400, configurable: true });
    act(() => onResize());

    expect(result.current.pixelPositionStyle?.left).not.toBe(before?.left);
    addSpy.mockRestore();
  });
});

describe('the resting launcher anchor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pins two edges, never four', async () => {
    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-1');
    const connect = vi.spyOn(streamClient, 'connect').mockResolvedValue();

    const { container } = renderWidget({}, { previewMode: false });
    await waitFor(() => expect(connect).toHaveBeenCalled());

    const anchor = container.querySelector<HTMLElement>('.mtx-fab-anchor');
    expect(anchor).not.toBeNull();
    const pinned = (['top', 'bottom', 'left', 'right'] as const).filter(edge => anchor?.style[edge] !== '');
    expect(pinned.sort()).toEqual(['bottom', 'right']);
  });
});

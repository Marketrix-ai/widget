/**
 * With two snaps in flight, `useDragSnap` commits the corner the widget is animating to, not the one
 * it left. `onPositionCommit` is the caller's door to persistence — in production `WidgetRoot` calls
 * `writeLocal` from it exactly once per drop, never per pointermove, and a later mount reads the same
 * key back through `StorageService`'s `readLocalParsed`/`scopedKey`, so a stored corner round-trips. A window
 * resize re-derives the launcher's anchor (and therefore re-clamps it inside the new viewport) because
 * `pixelPositionStyle` is computed from `window.innerWidth`/`innerHeight` at render time and the resize
 * listener only forces that re-render — there is no separate clamp step to duplicate. `renderDragSnap`
 * is the one hook-under-test setup every case below shares: a measured 56x56 wrapper (`wrapperFor`) at
 * the bottom-right corner, wired to whatever `onPositionCommit` a case needs. The resting-anchor and Stop
 * cases render the whole widget instead; Stop on the closed launcher must cancel a Show step still
 * waiting on the visitor, so a later click on the page neither runs the stopped tool nor answers it.
 */
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { createRef } from 'react';

import { WidgetSettingsDataSchema } from '../../../sdk/contracts/widgetSettings';
import * as chatSession from '../../../services/chatSession';
import { domService } from '../../../services/DomService';
import { ShowModeCancelled, showModeService } from '../../../services/ShowModeService';
import { readLocalParsed, scopedKey, writeLocal } from '../../../services/StorageService';
import { streamClient } from '../../../services/StreamClient';
import { asStreamClientInternals } from '../../../test/fixtures';
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
    expect(readLocalParsed(key, WidgetSettingsDataSchema.shape.widget_position)).toBe('top_left');
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

describe('Stop on the closed launcher while a Show step waits on the visitor', () => {
  afterEach(() => {
    showModeService.cleanup();
    vi.restoreAllMocks();
    resetDom();
  });

  it('cancels the pending step, so a later page click neither runs the tool nor posts a tool/response', async () => {
    Element.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 10 }) as DOMRect;
    Element.prototype.scrollIntoView = () => {};
    document.elementFromPoint = () => null;
    document.body.innerHTML = '<button style="position: fixed">Buy</button>';
    const target = document.querySelector('button') as HTMLButtonElement;
    let clicks = 0;
    target.addEventListener('click', () => clicks++);
    domService.reindexAndSnapshot();

    vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue('chat-stop');
    const connect = vi.spyOn(streamClient, 'connect').mockResolvedValue();
    const send = vi.spyOn(streamClient, 'send').mockResolvedValue();
    const staged = vi.spyOn(showModeService, 'showToolAction');
    renderWidget({}, { previewMode: false });
    await waitFor(() => expect(connect).toHaveBeenCalled());

    act(() => {
      asStreamClientInternals().handleMessage({
        type: 'tool/call',
        tool_call_id: 'tc-show',
        browser_tool: 'click_element',
        args: { index: 0 },
        mode: 'show',
        explanation: 'Click Buy',
      });
    });
    await waitFor(() => expect(document.getElementById('marketrix-show-highlight')).not.toBeNull());

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop' })));

    await expect(staged.mock.results[0]?.value).rejects.toBeInstanceOf(ShowModeCancelled);
    expect(document.getElementById('marketrix-show-highlight')).toBeNull();
    target.click();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });
    expect(clicks).toBe(1);
    expect(send.mock.calls.map(([command]) => command.type)).toEqual(['chat/stop']);
  });
});

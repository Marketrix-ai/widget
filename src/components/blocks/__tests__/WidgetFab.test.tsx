/**
 * Launcher drag tests, driven through the mounted widget: with two snaps in flight it commits the corner
 * the widget is animating to; a drop writes the position key once and a later mount reads the same
 * corner back; a viewport resize mid-drag re-derives the launcher anchor. `mountLauncher` is the shared
 * setup. The Stop case checks that Stop on the closed launcher cancels a Show step still waiting on the
 * visitor, so a later page click neither runs the stopped tool nor answers it.
 */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'bun:test';

import { WidgetSettingsDataSchema } from '../../../sdk/contracts/widgetSettings';
import * as chatSession from '../../../services/chatSession';
import { domService } from '../../../services/DomService';
import { ShowModeCancelled, showModeService } from '../../../services/ShowModeService';
import { readLocalParsed, scopedKey } from '../../../services/StorageService';
import { streamClient } from '../../../services/StreamClient';
import { asStreamClientInternals } from '../../../test/fixtures';
import { resetDom } from '../../../test/preload';
import { renderWidget } from '../../../test/renderWidget';

const mountLauncher = async (mtxId: string) => {
  vi.spyOn(chatSession, 'getOrCreateChatId').mockResolvedValue(`chat-${mtxId}`);
  const connect = vi.spyOn(streamClient, 'connect').mockResolvedValue();
  const { container } = renderWidget({ mtxId }, { previewMode: false });
  await waitFor(() => expect(connect).toHaveBeenCalled());
  const trigger = screen.getByRole('button', { name: 'Open' });
  trigger.setPointerCapture = () => {};
  trigger.releasePointerCapture = () => {};
  const anchor = container.querySelector<HTMLElement>('.mtx-fab-anchor');
  if (!anchor) throw new Error('launcher anchor not rendered');
  return { trigger, anchor };
};

const pinnedEdges = (anchor: HTMLElement) =>
  (['top', 'bottom', 'left', 'right'] as const).filter(edge => anchor.style[edge] !== '').sort();

const dragStart = (trigger: HTMLElement, x: number, y: number) => {
  fireEvent.pointerDown(trigger, { pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(trigger, { pointerId: 1, clientX: x, clientY: y });
};

const dragTo = (trigger: HTMLElement, x: number, y: number) => {
  dragStart(trigger, x, y);
  fireEvent.pointerUp(trigger, { pointerId: 1, clientX: x, clientY: y });
};

describe('dragging the launcher', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
    resetDom();
  });

  it('with two snaps in flight, commits the corner the widget is animating to, not the one it left', async () => {
    const { trigger } = await mountLauncher('drag-two-snaps');
    vi.useFakeTimers();

    dragTo(trigger, -window.innerWidth, 0);
    dragTo(trigger, 0, -window.innerHeight);
    act(() => vi.advanceTimersByTime(2000));

    const key = scopedKey('marketrix_widget_position', { mtxId: 'drag-two-snaps' });
    expect(readLocalParsed(key, WidgetSettingsDataSchema.shape.widget_position)).toBe('top_right');
  });

  it('writes the position key once per drop, and a later mount reads the same corner back', async () => {
    const key = scopedKey('marketrix_widget_position', { mtxId: 'drag-storage' });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { trigger } = await mountLauncher('drag-storage');
    vi.useFakeTimers();

    dragTo(trigger, -window.innerWidth, -window.innerHeight);
    act(() => vi.advanceTimersByTime(2000));
    vi.useRealTimers();

    expect(setItemSpy.mock.calls.filter(([storedKey]) => storedKey === key)).toHaveLength(1);
    cleanup();
    const { anchor } = await mountLauncher('drag-storage');
    expect(pinnedEdges(anchor)).toEqual(['left', 'top']);
  });

  it('re-anchors to a resized viewport mid-drag instead of keeping the stale anchor', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { trigger, anchor } = await mountLauncher('drag-resize');
    const resizeListeners = addSpy.mock.calls.filter(([type]) => type === 'resize').map(([, listener]) => listener);
    dragStart(trigger, -40, -40);
    const before = anchor.style.left;
    expect(before).not.toBe('');

    Object.defineProperty(window, 'innerWidth', { value: window.innerWidth + 400, configurable: true });
    act(() => resizeListeners.forEach(listener => (listener as () => void)()));

    expect(anchor.style.left).not.toBe(before);
  });
});

describe('the resting launcher anchor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pins two edges, never four', async () => {
    const { anchor } = await mountLauncher('resting');
    expect(pinnedEdges(anchor)).toEqual(['bottom', 'right']);
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

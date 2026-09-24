/**
 * Messenger panel tests, driven through the mounted widget: Escape and Tab are trapped inside the open
 * panel and focus returns to the host page when it closes; the panel's starting size follows the
 * dashboard settings; the grip drag-resizes from each pinned corner, and the keyboard arm reaches the
 * same clamp bounds as a drag. jsdom does no layout, so `offsetParent` is stubbed to make
 * `focusablesIn`'s visibility filter see a tab order.
 */
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'bun:test';

import * as chatThread from '../../../services/chatThread';
import { readChatSnapshot, writeChatSnapshot } from '../../../services/StorageService';
import { streamClient } from '../../../services/StreamClient';
import type { getMockWidgetConfig } from '../../../test/fixtures';
import { resetDom } from '../../../test/preload';
import { openWidget, renderWidget } from '../../../test/renderWidget';
import type { WidgetPosition } from '../../../types';
import { focusablesIn } from '../../../utils/dom';

Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get: () => document.body });

let tenantCount = 0;

const openPanel = (overrides: Parameters<typeof getMockWidgetConfig>[0] = {}) => {
  vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-shell');
  vi.spyOn(streamClient, 'connect').mockResolvedValue();
  const view = renderWidget({ mtxId: `tenant-${(tenantCount += 1)}`, ...overrides }, { previewMode: false });
  openWidget();
  const grip = screen.getByRole('separator');
  const panel = grip.parentElement;
  if (!panel) throw new Error('panel not rendered');
  return { ...view, panel, grip };
};

const isOpen = () => screen.queryByRole('separator') !== null;

const pressEscape = () =>
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
const pressTab = (shiftKey: boolean) =>
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
  });

const hostButton = () => {
  const host = document.createElement('button');
  host.textContent = 'host page control';
  document.body.appendChild(host);
  return host;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDom();
  writeChatSnapshot({ ...readChatSnapshot(), isOpen: false });
});

describe('the widget escape key belongs to the widget, not to the host page', () => {
  it('closes when focus is inside the panel', () => {
    const { panel } = openPanel();
    focusablesIn(panel)[0]?.focus();

    pressEscape();

    expect(isOpen()).toBe(false);
  });

  it('declines when focus is on the host page, as the Tab arm already does', () => {
    openPanel();
    hostButton().focus();

    pressEscape();

    expect(isOpen()).toBe(true);
  });
});

describe('Tab cycles inside the open panel', () => {
  it('wraps from the last control back to the first', () => {
    const { panel } = openPanel();
    const tabbable = focusablesIn(panel);
    tabbable.at(-1)?.focus();

    pressTab(false);

    expect(document.activeElement).toBe(tabbable[0] ?? null);
  });

  it('wraps from the first control back to the last on Shift+Tab', () => {
    const { panel } = openPanel();
    const tabbable = focusablesIn(panel);
    tabbable[0]?.focus();

    pressTab(true);

    expect(document.activeElement).toBe(tabbable.at(-1) ?? null);
  });
});

describe('closing the panel restores focus to what held it before', () => {
  it('returns focus to the launcher once the panel closes', () => {
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-shell');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    renderWidget({ mtxId: `tenant-${(tenantCount += 1)}` }, { previewMode: false });
    const launcher = screen.getByRole('button', { name: 'Open chat' });
    launcher.focus();

    openWidget();
    const panel = screen.getByRole('separator').parentElement as HTMLElement;
    expect(panel.contains(document.activeElement)).toBe(true);
    pressEscape();

    expect(document.activeElement).toBe(launcher);
  });
});

describe('the widget leaks no document listener across mount/unmount', () => {
  it('removes exactly what it added', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = openPanel();
    const added = addSpy.mock.calls.filter(([type]) => type === 'keydown').length;

    unmount();
    const removed = removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;

    expect(added).toBeGreaterThan(0);
    expect(removed).toBe(added);
  });
});

const sizeFor = (widget_width: string, widget_height: string) => {
  const { panel } = openPanel({ widget_width, widget_height });
  return { width: panel.style.width, height: panel.style.height };
};

describe('the panel size a dashboard setting produces', () => {
  it('uses a px setting as written', () => {
    expect(sizeFor('400px', '500px')).toEqual({ width: '400px', height: '500px' });
  });

  it('keeps the default for a length it cannot convert to px', () => {
    expect(sizeFor('20rem', '30em')).toEqual({ width: '360px', height: '450px' });
  });

  it('holds a setting below the drag range to the minimum a drag has', () => {
    expect(sizeFor('20px', '10px')).toEqual({ width: '280px', height: '320px' });
  });

  it('holds a setting above the drag range to the maximum a drag has', () => {
    expect(sizeFor('900px', '').width).toBe('600px');
  });
});

const OUTWARD: Record<WidgetPosition, { dx: number; dy: number }> = {
  bottom_right: { dx: -40, dy: -40 },
  bottom_left: { dx: 40, dy: -40 },
  top_right: { dx: -40, dy: 40 },
  top_left: { dx: 40, dy: 40 },
};

const drag = (position: WidgetPosition, dx: number, dy: number): CSSStyleDeclaration => {
  const { panel, grip } = openPanel({ widget_width: '400px', widget_height: '500px', widget_position: position });
  fireEvent.mouseDown(grip, { clientX: 0, clientY: 0 });
  act(() => {
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: dx, clientY: dy }));
    document.dispatchEvent(new MouseEvent('mouseup'));
  });
  return panel.style;
};

describe('the one grip is on the corner the panel is free to move', () => {
  it.each(Object.keys(OUTWARD) as WidgetPosition[])('grows when dragged outward from %s', position => {
    const { dx, dy } = OUTWARD[position];

    expect(drag(position, dx, dy)).toMatchObject({ width: '440px', height: '540px' });
  });

  it.each(Object.keys(OUTWARD) as WidgetPosition[])('shrinks when dragged inward from %s', position => {
    const { dx, dy } = OUTWARD[position];

    expect(drag(position, -dx, -dy)).toMatchObject({ width: '360px', height: '460px' });
  });
});

const keyResize = (key: string, times: number) => {
  const { panel, grip } = openPanel({ widget_width: '400px', widget_height: '500px' });
  for (let i = 0; i < times; i += 1) fireEvent.keyDown(grip, { key });
  return { width: panel.style.width, height: panel.style.height };
};

describe('the keyboard resize arm reaches the same clampSize path as a drag', () => {
  it('steps width by one KEYBOARD_RESIZE_STEP_PX per ArrowRight', () => {
    expect(keyResize('ArrowRight', 1).width).toBe('416px');
  });

  it('clamps to the same MAX_WIDTH a drag clamps to', () => {
    expect(keyResize('ArrowRight', 20).width).toBe('600px');
  });

  it('clamps to the same MIN_WIDTH a drag clamps to', () => {
    expect(keyResize('ArrowLeft', 20).width).toBe('280px');
  });

  it('ignores a key that is not one of the four resize arrows', () => {
    expect(keyResize('Enter', 1)).toEqual({ width: '400px', height: '500px' });
  });
});

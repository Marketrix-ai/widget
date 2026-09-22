/**
 * Tests for `useFocusTrap` (Escape/Tab trapping scoped to the messenger panel, and focus restore to the
 * host page on deactivation) and `useResize` (starting size from dashboard settings, drag-to-resize from
 * each pinned corner, and the keyboard-resize arm reaching the same clamp bounds as a drag). jsdom does
 * no layout, so `offsetParent` is stubbed to make `focusablesIn`'s visibility filter see a tab order.
 */
import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'bun:test';
import React, { useRef } from 'react';

import { WidgetConfigContext } from '../../../hooks/useWidget';
import { getMockWidgetConfig } from '../../../test/fixtures';
import type { WidgetPosition } from '../../../types';
import { useFocusTrap, useResize } from '../MessengerShell';

const renderResize = (overrides: Parameters<typeof getMockWidgetConfig>[0]) =>
  renderHook(() => useResize(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <WidgetConfigContext value={getMockWidgetConfig({ isPreviewMode: false, ...overrides })}>
        {children}
      </WidgetConfigContext>
    ),
  });

Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get: () => document.body });

const Harness: React.FC<{ isActive: boolean; onEscape: () => void }> = ({ isActive, onEscape }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, isActive, { onEscape });
  return (
    <div>
      <button type='button' data-testid='host'>
        host page control
      </button>
      <div ref={ref}>
        <button type='button' data-testid='first'>
          first widget control
        </button>
        <button type='button' data-testid='last'>
          last widget control
        </button>
      </div>
    </div>
  );
};

const pressEscape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
const pressTab = (shiftKey: boolean) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));

describe('the widget escape key belongs to the widget, not to the host page', () => {
  it('closes when focus is inside the trapped container', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Harness isActive onEscape={onEscape} />);
    getByTestId('first').focus();

    pressEscape();

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('declines when focus is on the host page, as the Tab arm already does', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Harness isActive onEscape={onEscape} />);
    getByTestId('host').focus();

    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });
});

describe('Tab cycles inside the trapped container', () => {
  it('wraps from the last control back to the first', () => {
    const { getByTestId } = render(<Harness isActive onEscape={vi.fn()} />);
    getByTestId('last').focus();

    pressTab(false);

    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('wraps from the first control back to the last on Shift+Tab', () => {
    const { getByTestId } = render(<Harness isActive onEscape={vi.fn()} />);
    getByTestId('first').focus();

    pressTab(true);

    expect(document.activeElement).toBe(getByTestId('last'));
  });
});

describe('deactivating the trap restores focus to what held it before', () => {
  it('returns focus to the FAB (or whatever was focused) once the panel closes', () => {
    const fab = document.createElement('button');
    fab.setAttribute('data-testid', 'fab');
    document.body.appendChild(fab);
    fab.focus();

    const { rerender, getByTestId } = render(<Harness isActive={false} onEscape={vi.fn()} />);
    rerender(<Harness isActive onEscape={vi.fn()} />);
    expect(document.activeElement).toBe(getByTestId('first'));

    rerender(<Harness isActive={false} onEscape={vi.fn()} />);

    expect(document.activeElement).toBe(fab);
  });
});

describe('the trap leaks no document listener across mount/unmount', () => {
  it('removes exactly what it added', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(<Harness isActive onEscape={vi.fn()} />);
    const added = addSpy.mock.calls.filter(([type]) => type === 'keydown').length;

    unmount();
    const removed = removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;

    expect(removed).toBe(added);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

const sizeFor = (widget_width: string, widget_height: string) =>
  renderResize({ widget_width, widget_height, mtxId: 'tenant' }).result.current;

describe('the panel size a dashboard setting produces', () => {
  it('uses a px setting as written', () => {
    expect(sizeFor('400px', '500px')).toMatchObject({ widthPx: '400px', heightPx: '500px' });
  });

  it('keeps the default for a length it cannot convert to px', () => {
    expect(sizeFor('20rem', '30em')).toMatchObject({ widthPx: '360px', heightPx: '450px' });
  });

  it('holds a setting outside the drag range to the same bounds a drag has', () => {
    expect(sizeFor('20px', '10px')).toMatchObject({ widthPx: '280px', heightPx: '320px' });
    expect(sizeFor('900px', '')).toMatchObject({ widthPx: '600px' });
  });
});

const OUTWARD: Record<WidgetPosition, { dx: number; dy: number }> = {
  bottom_right: { dx: -40, dy: -40 },
  bottom_left: { dx: 40, dy: -40 },
  top_right: { dx: -40, dy: 40 },
  top_left: { dx: 40, dy: 40 },
};

let dragCount = 0;

const drag = (position: WidgetPosition, dx: number, dy: number): CSSStyleDeclaration => {
  const { result } = renderResize({
    widget_width: '400px',
    widget_height: '500px',
    widget_position: position,
    mtxId: `tenant-${(dragCount += 1)}`,
  });
  const panel = document.createElement('div');
  result.current.containerRef.current = panel;

  act(() =>
    result.current.onResizeStart({
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: 0,
      clientY: 0,
    } as React.MouseEvent),
  );
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

const keyResize = (key: string, times: number, config: { mtxId: string }) => {
  const { result } = renderResize({ widget_width: '400px', widget_height: '500px', ...config });
  for (let i = 0; i < times; i += 1) {
    act(() => result.current.onResizeKeyDown({ key, preventDefault: () => {} } as unknown as React.KeyboardEvent));
  }
  return result.current;
};

describe('the keyboard resize arm reaches the same clampSize path as a drag', () => {
  it('steps width by one KEYBOARD_RESIZE_STEP_PX per ArrowRight', () => {
    expect(keyResize('ArrowRight', 1, { mtxId: `tenant-${(dragCount += 1)}` })).toMatchObject({
      widthPx: '416px',
    });
  });

  it('clamps to the same MAX_WIDTH a drag clamps to', () => {
    expect(keyResize('ArrowRight', 20, { mtxId: `tenant-${(dragCount += 1)}` })).toMatchObject({
      widthPx: '600px',
    });
  });

  it('clamps to the same MIN_WIDTH a drag clamps to', () => {
    expect(keyResize('ArrowLeft', 20, { mtxId: `tenant-${(dragCount += 1)}` })).toMatchObject({
      widthPx: '280px',
    });
  });

  it('ignores a key that is not one of the four resize arrows', () => {
    expect(keyResize('Enter', 1, { mtxId: `tenant-${(dragCount += 1)}` })).toMatchObject({
      widthPx: '400px',
      heightPx: '500px',
    });
  });
});

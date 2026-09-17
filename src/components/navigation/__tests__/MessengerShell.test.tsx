/**
 * `useFocusTrap` tests: Escape closes the widget when focus is inside the trapped container and is
 * declined when focus is on the host page — the key belongs to the widget only while it has focus. Tab
 * and Shift+Tab cycle within the container without ever handing focus back to the host page, and
 * deactivating the trap (panel close) returns focus to whatever the host page had focused before
 * activation (the FAB, in production). The trap's own `document`-level listener is removed on unmount —
 * asserted by diffing `addEventListener`/`removeEventListener` call counts, since a leaked listener here
 * would keep intercepting the host page's Tab/Escape after the widget panel is gone. jsdom does no
 * layout, so every element reports `offsetParent === null` and `focusablesIn`'s visibility filter would
 * drop the whole tab order — stubbed the same way `dom.test.ts`/`keySimulation.test.ts` do.
 *
 * `useResize` tests: how a dashboard width/height setting resolves to a starting size, how dragging the
 * one grip resizes the panel from each pinned corner, and how the keyboard-resize arm reaches that same
 * `clampSize` path and boundary as a drag.
 *
 * `sizeFor` renders the hook with only the two settings varying and returns its result: a `px` setting
 * is used verbatim; a length the hook can't convert to px (`rem`, `em` — it parses `<number>px` only)
 * falls back to the 360x450 default; a setting outside the drag range clamps to the same bounds a drag
 * clamps to (280/600 wide, 320 tall min). The over-max case asserts width only, since the height
 * ceiling is 85% of `window.innerHeight`, pinning jsdom's viewport.
 *
 * `OUTWARD` is the pointer delta moving the grip away from the pinned corner — the grip sits diagonally
 * opposite, so the sign flips with the anchor and negating it gives the inward drag. `drag` runs a
 * whole mousedown → mousemove → mouseup against a detached div and returns its inline style: the drag
 * path writes width/height straight to the element (skipping a re-render per mousemove), only the
 * settled size reaching React state via `act`. Each `drag`/`resizeHook` mints a fresh `tenant-N` scope
 * (`dragCount`) since a settled drag or keyboard step persists to localStorage under
 * `marketrix_widget_size_<scope>`, and a stored size wins on the next mount — one shared scope would
 * leak a case's result into the next. `isPreviewMode` is false: preview mode returns before binding
 * anything, so no drag, no write.
 */
import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'bun:test';
import React, { useRef } from 'react';

import type { MarketrixConfig, WidgetPosition } from '../../../types';
import { useFocusTrap, useResize } from '../MessengerShell';

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

const sizeFor = (width: string | undefined, height: string | undefined) =>
  renderHook(() => useResize(width, height, 'bottom_right', { mtxId: 'tenant' }, false)).result.current;

describe('the panel size a dashboard setting produces', () => {
  it('uses a px setting as written', () => {
    expect(sizeFor('400px', '500px')).toMatchObject({ widthPx: '400px', heightPx: '500px' });
  });

  it('keeps the default for a length it cannot convert to px', () => {
    expect(sizeFor('20rem', '30em')).toMatchObject({ widthPx: '360px', heightPx: '450px' });
  });

  it('holds a setting outside the drag range to the same bounds a drag has', () => {
    expect(sizeFor('20px', '10px')).toMatchObject({ widthPx: '280px', heightPx: '320px' });
    expect(sizeFor('900px', undefined)).toMatchObject({ widthPx: '600px' });
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
  const config: MarketrixConfig = { mtxId: `tenant-${(dragCount += 1)}` };
  const { result } = renderHook(() => useResize('400px', '500px', position, config, false));
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

const keyResize = (key: string, times: number, config: MarketrixConfig) => {
  const { result } = renderHook(() => useResize('400px', '500px', 'bottom_right', config, false));
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

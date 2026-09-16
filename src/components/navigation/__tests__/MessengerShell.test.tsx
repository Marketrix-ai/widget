/**
 * `useFocusTrap` tests: Escape closes the widget when focus is inside the trapped container and is
 * declined when focus is on the host page — the key belongs to the widget only while it has focus.
 *
 * `useResize` tests: how a dashboard width/height setting resolves to a starting size, and how
 * dragging the one grip resizes the panel from each pinned corner.
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
 * settled size reaching React state via `act`. Each `drag` mints a fresh `tenant-N` scope (`dragCount`)
 * since a settled drag persists to localStorage under `marketrix_widget_size_<scope>`, and a stored
 * size wins on the next mount — one shared scope would leak a case's result into the next.
 * `isPreviewMode` is false: preview mode returns before binding anything, so no drag, no write.
 */
import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'bun:test';
import React, { useRef } from 'react';

import type { MarketrixConfig, WidgetPosition } from '../../../types';
import { useFocusTrap, useResize } from '../MessengerShell';

const Harness: React.FC<{ onEscape: () => void }> = ({ onEscape }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, { onEscape });
  return (
    <div>
      <button type='button' data-testid='host'>
        host page control
      </button>
      <div ref={ref}>
        <button type='button' data-testid='inside'>
          widget control
        </button>
      </div>
    </div>
  );
};

const pressEscape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('the widget escape key belongs to the widget, not to the host page', () => {
  it('closes when focus is inside the trapped container', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Harness onEscape={onEscape} />);
    getByTestId('inside').focus();

    pressEscape();

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('declines when focus is on the host page, as the Tab arm already does', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Harness onEscape={onEscape} />);
    getByTestId('host').focus();

    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
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

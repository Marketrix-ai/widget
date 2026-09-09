/**
 * With two snaps in flight, `useDragSnap` commits the corner the widget is animating to, not the one
 * it left.
 */
import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WidgetPosition } from '../types';
import { useDragSnap } from './useDragSnap';

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

describe('two snaps in flight', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('commits the corner the widget is animating to, not the one it left', () => {
    const committed: WidgetPosition[] = [];
    const wrapperRef = createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
    (wrapperRef as { current: HTMLDivElement }).current = wrapperFor();

    const { result } = renderHook(() =>
      useDragSnap({
        position: 'bottom_right',
        onPositionCommit: (corner: WidgetPosition) => committed.push(corner),
        wrapperRef,
      }),
    );

    dragTo(result.current, -window.innerWidth, 0);
    dragTo(result.current, 0, -window.innerHeight);
    act(() => vi.advanceTimersByTime(2000));

    expect(committed.length).toBeGreaterThan(0);
    expect(committed[committed.length - 1]).toBe('top_right');
  });
});

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSyncExternalStoreWithSelector } from '../useSyncExternalStoreShim';

function makeStore(initial: { count: number; other: string }) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (onStoreChange: () => void) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    getSnapshot: () => state,
    set(next: typeof state) {
      state = next;
      listeners.forEach(listener => listener());
    },
  };
}

describe('the shim that stands in for use-sync-external-store/shim/with-selector', () => {
  it('tracks the selected slice, and a fresh object per call does not loop', () => {
    const store = makeStore({ count: 1, other: 'a' });
    const Probe = () => {
      const selected = useSyncExternalStoreWithSelector(store.subscribe, store.getSnapshot, undefined, snapshot => ({
        count: snapshot.count,
      }));
      return <div data-testid='count'>{selected.count}</div>;
    };

    render(<Probe />);
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    act(() => store.set({ count: 2, other: 'a' }));

    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('holds the previous selection when isEqual says the slice did not change', () => {
    const store = makeStore({ count: 1, other: 'a' });
    const seen: Array<{ count: number }> = [];
    const Probe = () => {
      const selected = useSyncExternalStoreWithSelector(
        store.subscribe,
        store.getSnapshot,
        undefined,
        snapshot => ({ count: snapshot.count }),
        (previous, next) => previous.count === next.count,
      );
      seen.push(selected);
      return <div data-testid='count'>{selected.count}</div>;
    };

    render(<Probe />);
    act(() => store.set({ count: 1, other: 'b' }));

    expect(new Set(seen).size).toBe(1);
  });
});

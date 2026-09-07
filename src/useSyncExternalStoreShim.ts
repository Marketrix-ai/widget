import { useRef, useSyncExternalStore as useReactSyncExternalStore } from 'react';

export { useSyncExternalStore } from 'react';

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (previous: Selection, next: Selection) => boolean,
): Selection {
  const memo = useRef<{ snapshot: Snapshot; selection: Selection } | null>(null);

  const select = (snapshot: Snapshot): Selection => {
    const cached = memo.current;
    if (cached && Object.is(cached.snapshot, snapshot)) return cached.selection;

    const next = selector(snapshot);
    const selection = cached && isEqual?.(cached.selection, next) ? cached.selection : next;
    memo.current = { snapshot, selection };
    return selection;
  };

  return useReactSyncExternalStore(
    subscribe,
    () => select(getSnapshot()),
    getServerSnapshot && (() => select(getServerSnapshot())),
  );
}

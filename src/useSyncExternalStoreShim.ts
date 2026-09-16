/**
 * A local stand-in for both `use-sync-external-store/shim` and `use-sync-external-store/shim/with-selector`,
 * aliased onto this file in `vite.config.ts` so neither package is a runtime dependency of the bundle.
 * `@base-ui/react` (`useIsHydrating.js`, `useStore.js`) requires both subpaths directly, so both the bare
 * `useSyncExternalStore` re-export and `useSyncExternalStoreWithSelector` below are load-bearing even
 * though nothing in this repo's own source imports either by name — a static unused-export scan cannot
 * see the alias and will misflag both as dead (a knip false positive, kept on rather than deleted).
 * `useSyncExternalStoreWithSelector` memoises the selection per snapshot identity and, when `isEqual`
 * says the slice did not change, returns the previous selection — which is what keeps a selector
 * returning a fresh object from re-rendering forever.
 */
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

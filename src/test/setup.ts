/**
 * Vitest global setup (`setupFiles` in `vitest.config.ts`), run once per test file before any suite:
 * registers the jest-dom matchers and fills the three browser globals jsdom does not usably provide here.
 *
 * `localStorage` — a Map-backed `Storage` (getItem/setItem/removeItem/clear/length/key). jsdom defines it
 * on the prototype, and that does not transfer to vitest's `globalThis`, leaving `StorageService` — the one
 * door to it in `src/` — an object with no `setItem`; hence the guard probes for the method, not the property.
 * `matchMedia` — a never-matching `MediaQueryList` with inert listener registration, required by
 * `useScrollLock`. `ResizeObserver` — an inert observe/unobserve/disconnect class, required by
 * `useDragSnap`.
 *
 * Every fill is conditional, so a real implementation — a future jsdom, or a per-test override
 * installed before this file — wins.
 */
import '@testing-library/jest-dom/vitest';

if (typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  } as Storage;
}

if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = (media: string) =>
    ({
      media,
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

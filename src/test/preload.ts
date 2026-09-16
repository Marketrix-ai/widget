/**
 * `bunfig.toml` `[test] preload` entry — the sole DOM bootstrap for `bun test`, replacing vitest's
 * jsdom `environment` option (bun has none) plus the retired `src/test/setup.ts`. Uses jsdom, not
 * happy-dom: React 19's event delegation needs real `MouseEvent`/`KeyboardEvent` construction and
 * bubbling that happy-dom doesn't reproduce faithfully enough for `fireEvent`/`userEvent`.
 *
 * `globalThis.window = globalThis` makes `window` and `global` the same object, like a real browser's
 * top frame: jsdom's `Window.prototype.location` is non-configurable and cannot be redefined on jsdom's
 * OWN instance, yet tests stub navigation via `Object.defineProperty(window, 'location', ...)` — that
 * only works on a plain, freely-reconfigurable object. Function-valued properties are copied BOUND to
 * the real jsdom window (its WebIDL implementations brand-check `this`), which still lets
 * `vi.spyOn`/`defineProperty` replace the copied slot with a mock.
 *
 * `require()`, not a static `import`, loads jest-dom/`@testing-library/dom` AFTER the DOM globals below
 * are in place: a static import is hoisted before this file's own setup runs, and `@testing-library/dom`'s
 * `screen` singleton binds to `document`/`document.body` at its own first module evaluation — whichever
 * import reaches it first decides the binding for bun's single-process test run.
 *
 * `localStorage`/`matchMedia`/`ResizeObserver` are filled because jsdom doesn't survive `localStorage`
 * onto `globalThis` and ships neither of the other two, which `useDragSnap`/`useScrollLock`/
 * `StorageService` need. `forceOverride` copies event constructors from jsdom even though Bun has its
 * own natives, since `document.createElement`'s elements brand-check `dispatchEvent`'s argument against
 * JSDOM's OWN `Event` class. `isNamespaceLike` copies a class or plain-function namespace (jsdom's
 * `NodeFilter`) UNBOUND, since `bind` strips `.prototype` and own properties, which would break
 * prototype patching and `NodeFilter`'s constants. The bulk-copy loop's `try/catch` swallows only an
 * already-non-configurable accessor (e.g. `crypto`).
 *
 * `resetDom` clears the body for tests that mount outside Testing Library's render tree, run
 * automatically in `afterEach` here so every test file gets it for free.
 */
import { afterEach, expect } from 'bun:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const { window } = dom;
const skip = new Set(['window', 'globalThis', 'self', 'top', 'parent']);
const forceOverride = new Set([
  'Event',
  'CustomEvent',
  'UIEvent',
  'MouseEvent',
  'KeyboardEvent',
  'PointerEvent',
  'InputEvent',
  'FocusEvent',
  'AnimationEvent',
  'TransitionEvent',
  'EventTarget',
]);
const OWN_FUNCTION_PROPS = new Set(['length', 'name', 'prototype', 'arguments', 'caller']);
const isNamespaceLike = (value: unknown): boolean =>
  typeof value === 'function' &&
  (Function.prototype.toString.call(value).startsWith('class') ||
    Object.getOwnPropertyNames(value).some(prop => !OWN_FUNCTION_PROPS.has(prop)));
for (const key of Object.getOwnPropertyNames(window)) {
  if (skip.has(key) || (key in globalThis && !forceOverride.has(key))) continue;
  const value = (window as unknown as Record<string, unknown>)[key];
  try {
    // @ts-expect-error -- bulk-copying the jsdom window onto globalThis by design
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- `value` is genuinely untyped window surface
    globalThis[key] = typeof value === 'function' && !isNamespaceLike(value) ? value.bind(window) : value;
  } catch {
    /* empty */
  }
}
globalThis.window = globalThis as unknown as Window & typeof globalThis;
globalThis.document = window.document;
globalThis.navigator = window.navigator;

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

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports -- see file header: must run after `document` exists
const matchers = require('@testing-library/jest-dom/matchers') as typeof import('@testing-library/jest-dom/matchers');
expect.extend(matchers);

export function resetDom(): void {
  document.body.replaceChildren();
}

afterEach(() => {
  resetDom();
});

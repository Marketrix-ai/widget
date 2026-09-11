/**
 * `bunfig.toml` `[test] preload` entry — the sole DOM bootstrap for `bun test`, replacing vitest's
 * jsdom `environment` option (bun has none) plus this repo's old `src/test/setup.ts`.
 *
 * jsdom, not happy-dom: React 19's event delegation depends on real `MouseEvent`/`KeyboardEvent`
 * construction and bubbling semantics that happy-dom's lighter DOM does not reproduce faithfully
 * enough for `@testing-library/react`'s `fireEvent`/`userEvent` — jsdom is what CRA/RTL/vitest's own
 * default all standardize on, and this repo already carries it as a devDependency (`environment:
 * jsdom` in the retired `vitest.config.ts`).
 *
 * **`globalThis.window = globalThis`** (self-referential, exactly like a real browser's top frame and
 * exactly what vitest's own jsdom environment hands a test file — there, `window` and `global` are the
 * SAME vm-context object). This is not cosmetic: jsdom's `Window.prototype.location` accessor is
 * `configurable: false` by spec and cannot be redefined on jsdom's OWN `Window` instance at any
 * price, yet several tests stub navigation via `Object.defineProperty(window, 'location', ...)`. Doing
 * that only works when `location` (and `open`, `close`, …) are copied onto a fresh, ordinary object —
 * `globalThis` — as plain, freely-reconfigurable data properties, rather than living on jsdom's
 * locked-down instance; making `window` an alias for that same object is what lets product code's
 * `window.location.href = …` and a test's `Object.defineProperty(window, 'location', …)` agree on which
 * `location` they mean. Function-valued properties (`open`, `close`, `addEventListener`, …) are copied
 * bound to the real jsdom window, since jsdom's WebIDL implementations brand-check `this` and would
 * reject being called with `globalThis` as receiver otherwise; `bind` also does not stop `vi.spyOn` /
 * `Object.defineProperty` from replacing the copied slot with a mock, since that replaces the property,
 * not the function it currently holds.
 *
 * `@testing-library/dom`'s `screen` singleton reads `document`/`document.body` once, at that MODULE's
 * own first evaluation — not per call — and `bun test` runs every file in one process, so whichever
 * import reaches that module first decides the binding for the entire run. `@testing-library/jest-dom`
 * (needed for the `expect` matchers below) transitively requires `@testing-library/dom` itself, and a
 * plain `import` of it — even textually below this comment — is hoisted by the ES module spec to
 * evaluate before any of this file's own imperative DOM setup, which is what poisoned `screen` for
 * every test. `require()`, run after the DOM globals below are in place, is the one synchronous,
 * textually-ordered way to load both jest-dom and `@testing-library/dom` after `document` is real.
 *
 * `localStorage`/`matchMedia`/`ResizeObserver` fills are unchanged from the old `setup.ts`: jsdom
 * defines `localStorage` on a prototype that does not survive onto `globalThis` here either, jsdom has
 * no `matchMedia`, and no `ResizeObserver` — `useDragSnap` needs the observer, `useScrollLock` needs
 * `matchMedia`, and `StorageService` (the one door to storage in `src/`) needs a real `setItem`. Since
 * `window` now IS `globalThis`, a single fill on `globalThis` covers both spellings.
 */
import { afterEach, expect } from 'bun:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const { window } = dom;
const skip = new Set(['window', 'globalThis', 'self', 'top', 'parent']);
// Bun ships its OWN native `Event`/`EventTarget`/`CustomEvent`/… (Web-standard globals that predate
// this loop running), and the general copy below leaves any already-present global alone so Bun's
// `fetch`/`Request`/`Response`/etc. keep working for code that never touches the DOM. But an element
// created via `document.createElement` brand-checks `dispatchEvent`'s argument against JSDOM's OWN
// `Event` class, so `new Event(...)` built from Bun's native class fails jsdom's internal
// `exports.is()` check with "parameter 1 is not of type 'Event'" — these specific event constructors
// must be jsdom's, unconditionally, for anything dispatched at a jsdom element to be accepted.
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
// A `class` declaration is a function too, and `Element`/`HTMLElement`/`Node`/`MouseEvent`/… must be
// copied UNBOUND: `Function.prototype.bind` strips `.prototype` off the result, so binding a
// constructor would silence every `Element.prototype.foo = …` a test installs (bun compat shims and
// this repo's own tests both rely on prototype patching, e.g. `getBoundingClientRect`). `NodeFilter`
// is the same trap in a different shape: jsdom implements it as a plain arrow function (not a `class`)
// that carries its `SHOW_ELEMENT`/`FILTER_ACCEPT`/… constants as own properties — `bind` drops those
// too, silently breaking every `TreeWalker` in `src/` (its `acceptNode` return value stops matching any
// `FILTER_*` constant, so the walk silently visits nothing). Anything carrying its own extra
// properties beyond a function's intrinsic ones is a namespace/constructor, never a `this`-bound
// method, so it is copied unbound the same way a class is.
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
    // Some window accessors (e.g. `crypto`) are non-configurable on globalThis already; skip those.
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

/** Shared body-clearing helper for tests that mount outside Testing Library's render tree. */
export function resetDom(): void {
  document.body.replaceChildren();
}

afterEach(() => {
  resetDom();
});

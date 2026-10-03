/**
 * `bunfig.toml`'s `[test] preload` entry — the sole DOM bootstrap for `bun test`.
 * Copies a jsdom `Window` onto `globalThis`, fills in `localStorage`/`matchMedia`/`ResizeObserver`, wires
 * jest-dom matchers, and `resetDom` clears the body after each test. The matchers are required, not imported, because
 * testing-library needs the global `document` while it loads.
 */
import { afterEach, type CustomMatcher, expect } from 'bun:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

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
const adopt = (key: string, value: unknown): void => {
  Reflect.set(globalThis, key, typeof value === 'function' && !isNamespaceLike(value) ? value.bind(dom.window) : value);
};
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (skip.has(key) || (key in globalThis && !forceOverride.has(key))) continue;
  try {
    adopt(key, Reflect.get(dom.window, key));
  } catch (error) {
    if (!(error instanceof TypeError)) console.error(`[preload] Unexpected failure copying window.${key}:`, error);
  }
}
Reflect.set(globalThis, 'window', globalThis);
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;

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
  };
}

if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = (media: string): MediaQueryList => ({
    media,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

type Matchers = Record<string, CustomMatcher<unknown, unknown[]>>;
const isMatchers = (mod: unknown): mod is Matchers =>
  typeof mod === 'object' && mod !== null && Object.keys(mod).every(key => typeof Reflect.get(mod, key) === 'function');
function matchersOf(mod: unknown): Matchers {
  if (!isMatchers(mod)) throw new Error('@testing-library/jest-dom/matchers exports something other than matchers');
  return mod;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
expect.extend(matchersOf(require('@testing-library/jest-dom/matchers')));

export function resetDom(): void {
  document.body.replaceChildren();
}

afterEach(() => {
  resetDom();
});

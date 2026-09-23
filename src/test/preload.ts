/**
 * `bunfig.toml`'s `[test] preload` entry — the sole DOM bootstrap for `bun test`.
 * Copies a jsdom `Window` onto `globalThis`, fills in `localStorage`/`matchMedia`/`ResizeObserver`, wires
 * jest-dom matchers, and `resetDom` clears the body after each test.
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
  } catch (error) {
    if (!(error instanceof TypeError)) console.error(`[preload] Unexpected failure copying window.${key}:`, error);
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

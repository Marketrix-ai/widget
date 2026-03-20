import '@testing-library/jest-dom/vitest';

// jsdom does not provide ResizeObserver (required by WidgetButton and others)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

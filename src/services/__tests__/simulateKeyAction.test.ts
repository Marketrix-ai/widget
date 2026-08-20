import { afterEach, describe, expect, it } from 'vitest';

import { browserToolService } from '../BrowserToolService';

const simulateKeyAction = (element: HTMLElement, key: string) =>
  (
    browserToolService as unknown as {
      simulateKeyAction(element: HTMLElement, key: string): string | null;
    }
  ).simulateKeyAction(element, key);

// jsdom has no layout, so every element reports offsetParent === null and the visibility filter would drop them all.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get: () => document.body });

const render = () => {
  document.body.innerHTML = '<button id="a"></button><button id="b"></button><button id="c"></button>';
  return ['a', 'b', 'c'].map(id => document.getElementById(id) as HTMLElement);
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('simulateKeyAction Tab/Shift+Tab', () => {
  it('moves focus forward and backward', () => {
    const [a, b, c] = render();
    expect(simulateKeyAction(b, 'Tab')).toBe('Tab: moved focus to button#c');
    expect(document.activeElement).toBe(c);
    expect(simulateKeyAction(b, 'Shift+Tab')).toBe('Shift+Tab: moved focus to button#a');
    expect(document.activeElement).toBe(a);
  });

  it('refuses at each end', () => {
    const [a, , c] = render();
    expect(simulateKeyAction(c, 'Tab')).toBe('Tab: no next focusable element');
    expect(simulateKeyAction(a, 'Shift+Tab')).toBe('Shift+Tab: no previous focusable element');
  });

  it('refuses an element outside the tab order — indexOf -1 must not wrap to the first element', () => {
    render();
    const detached = document.createElement('div');
    expect(simulateKeyAction(detached, 'Tab')).toBe('Tab: no next focusable element');
    expect(simulateKeyAction(detached, 'Shift+Tab')).toBe('Shift+Tab: no previous focusable element');
    expect(document.activeElement).toBe(document.body);
  });
});

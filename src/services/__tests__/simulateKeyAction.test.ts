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

describe('simulateKeyAction Backspace/Delete', () => {
  const input = (value: string, start: number, end = start) => {
    document.body.innerHTML = '<input />';
    const el = document.querySelector('input') as HTMLInputElement;
    el.value = value;
    el.setSelectionRange(start, end);
    return el;
  };

  it('deletes around the caret and leaves it in the right place', () => {
    const back = input('abcd', 3);
    expect(simulateKeyAction(back, 'Backspace')).toBe('Backspace: deleted character, value is now "abd"');
    expect([back.value, back.selectionStart]).toEqual(['abd', 2]);

    const del = input('abcd', 1);
    expect(simulateKeyAction(del, 'Delete')).toBe('Delete: deleted character, value is now "acd"');
    expect([del.value, del.selectionStart]).toEqual(['acd', 1]);
  });

  it('deletes the selection when there is one', () => {
    const el = input('abcdef', 1, 4);
    expect(simulateKeyAction(el, 'Backspace')).toBe('Backspace: deleted character, value is now "aef"');
    expect([el.value, el.selectionStart]).toEqual(['aef', 1]);
  });

  it('fires input and change so controlled inputs see the edit', () => {
    const el = input('abcd', 4);
    const seen: string[] = [];
    for (const type of ['input', 'change']) el.addEventListener(type, e => seen.push(e.type));
    simulateKeyAction(el, 'Backspace');
    expect(seen).toEqual(['input', 'change']);
  });

  it('refuses when there is nothing to delete', () => {
    expect(simulateKeyAction(input('', 0), 'Backspace')).toBe('Backspace: input is empty, nothing to delete');
    expect(simulateKeyAction(input('abcd', 4), 'Delete')).toBe('Delete: cursor at end, nothing to delete');
  });
});

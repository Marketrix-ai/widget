/**
 * Tests for `simulateKeyAction`, the default action each agent-sent key carries out on a host-page element.
 */

import { afterEach, describe, expect, it } from 'bun:test';

import { resetDom } from '../../test/preload';
import { simulateKeyAction } from '../keySimulation';

Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get: () => document.body });

const render = (): [HTMLElement, HTMLElement, HTMLElement] => {
  document.body.innerHTML = '<button id="a"></button><button id="b"></button><button id="c"></button>';
  return ['a', 'b', 'c'].map(id => document.getElementById(id) as HTMLElement) as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ];
};

afterEach(() => {
  resetDom();
});

describe('simulateKeyAction Tab', () => {
  it('moves focus forward', () => {
    const [, b, c] = render();
    expect(simulateKeyAction(b, 'Tab')).toBe('Tab: moved focus to button#c');
    expect(document.activeElement).toBe(c);
  });

  it('refuses at the end', () => {
    const [, , c] = render();
    expect(simulateKeyAction(c, 'Tab')).toBe('Tab: no next focusable element');
  });

  it('refuses an element outside the tab order — indexOf -1 must not wrap to the first element', () => {
    render();
    const detached = document.createElement('div');
    expect(simulateKeyAction(detached, 'Tab')).toBe('Tab: no next focusable element');
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

  it.each(['input', 'textarea'])(
    'writes through the same prototype setter for %s, so a controlled component observes it identically',
    tag => {
      document.body.innerHTML = `<${tag}></${tag}>`;
      const el = document.querySelector(tag) as HTMLInputElement | HTMLTextAreaElement;
      el.value = 'abcd';
      el.setSelectionRange(3, 3);

      expect(simulateKeyAction(el, 'Backspace')).toBe('Backspace: deleted character, value is now "abd"');
      expect([el.value, el.selectionStart]).toEqual(['abd', 2]);
    },
  );

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
    expect(simulateKeyAction(input('', 0), 'Backspace')).toBe('Backspace: cursor at start, nothing to delete');
    expect(simulateKeyAction(input('abcd', 4), 'Delete')).toBe('Delete: cursor at end, nothing to delete');
  });

  it('leaves the value alone at the start — a caret Home put at 0 is a position, not a missing one', () => {
    const el = input('abcd', 4);
    expect(simulateKeyAction(el, 'Home')).toBe('Home: moved cursor to start');
    expect(simulateKeyAction(el, 'Backspace')).toBe('Backspace: cursor at start, nothing to delete');
    expect(el.value).toBe('abcd');
  });

  it('reads an unknown caret as being at the END of the value, not the start', () => {
    const el = input('abcd', 4);
    Object.defineProperty(el, 'selectionStart', { configurable: true, get: () => null });
    Object.defineProperty(el, 'selectionEnd', { configurable: true, get: () => null });

    expect(simulateKeyAction(el, 'Backspace')).toBe('Backspace: deleted character, value is now "abc"');
    expect(el.value).toBe('abc');
  });
});

describe('simulateKeyAction ArrowDown/ArrowUp on a select', () => {
  const select = (options: string[], selectedIndex: number) => {
    document.body.innerHTML = `<select>${options.map(o => `<option>${o}</option>`).join('')}</select>`;
    const el = document.querySelector('select') as HTMLSelectElement;
    el.selectedIndex = selectedIndex;
    return el;
  };

  it('steps forward and backward, refusing at either end', () => {
    const el = select(['a', 'b', 'c'], 0);
    expect(simulateKeyAction(el, 'ArrowDown')).toBe('ArrowDown: selected "b"');
    expect(simulateKeyAction(el, 'ArrowDown')).toBe('ArrowDown: selected "c"');
    expect(simulateKeyAction(el, 'ArrowDown')).toBe('ArrowDown: already at last option');
    expect(simulateKeyAction(el, 'ArrowUp')).toBe('ArrowUp: selected "b"');
    expect(simulateKeyAction(select(['a'], 0), 'ArrowUp')).toBe('ArrowUp: already at first option');
  });
});

describe('simulateKeyAction Enter', () => {
  const inForm = (field: string) => {
    document.body.innerHTML = `<form>${field}<button type="submit"></button></form>`;
    const submits: string[] = [];
    document.querySelector('button')!.addEventListener('click', () => submits.push('submit'));
    document.querySelector('form')!.addEventListener('submit', e => e.preventDefault());
    return submits;
  };

  it('inserts a line break in a textarea instead of submitting its form', () => {
    const submits = inForm('<textarea></textarea>');
    const el = document.querySelector('textarea')!;
    el.value = 'ab';
    el.setSelectionRange(1, 1);
    expect(simulateKeyAction(el, 'Enter')).toBe('Enter: inserted a line break');
    expect([el.value, el.selectionStart]).toEqual(['a\nb', 2]);
    expect(submits).toEqual([]);
  });

  it('submits the form of an input', () => {
    const submits = inForm('<input />');
    expect(simulateKeyAction(document.querySelector('input')!, 'Enter')).toBe('Enter: clicked form submit button');
    expect(submits).toEqual(['submit']);
  });
});

describe('simulateKeyAction ArrowLeft/ArrowRight and PageUp/PageDown', () => {
  it('moves the caret within a text field, clamped to its value', () => {
    document.body.innerHTML = '<input />';
    const el = document.querySelector('input')!;
    el.value = 'ab';
    el.setSelectionRange(1, 1);
    expect(simulateKeyAction(el, 'ArrowLeft')).toBe('ArrowLeft: moved cursor to 0');
    expect(simulateKeyAction(el, 'ArrowLeft')).toBe('ArrowLeft: moved cursor to 0');
    el.setSelectionRange(2, 2);
    expect(simulateKeyAction(el, 'ArrowRight')).toBe('ArrowRight: moved cursor to 2');
  });

  it('scrolls the page by one viewport', () => {
    const scrolls: unknown[] = [];
    const original = window.scrollBy;
    window.scrollBy = ((options: ScrollToOptions) => scrolls.push(options.top)) as typeof window.scrollBy;
    try {
      expect(simulateKeyAction(document.body, 'PageDown')).toBe('PageDown: scrolled the page');
      expect(simulateKeyAction(document.body, 'PageUp')).toBe('PageUp: scrolled the page');
    } finally {
      window.scrollBy = original;
    }
    expect(scrolls).toEqual([window.innerHeight, -window.innerHeight]);
  });
});

describe('simulateKeyAction Escape', () => {
  it('blurs without re-dispatching the keydown the caller already fired', () => {
    const [a] = render();
    a.focus();
    const seen: string[] = [];
    document.addEventListener('keydown', e => seen.push(e.key));
    expect(simulateKeyAction(a, 'Escape')).toBe('Escape: blurred element');
    expect([seen, document.activeElement]).toEqual([[], document.body]);
  });
});

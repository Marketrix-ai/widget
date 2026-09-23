/**
 * Tests for `focusablesIn`, the tabbable-candidate filter shared by `useFocusTrap` and `keySimulation`:
 * an `aria-hidden` element and its whole subtree are skipped.
 */
import { afterEach, describe, expect, it } from 'bun:test';

import { resetDom } from '../../test/preload';
import { focusablesIn } from '../dom';

Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get: () => document.body });

afterEach(() => {
  resetDom();
});

describe('focusablesIn', () => {
  it('excludes an element carrying aria-hidden="true"', () => {
    document.body.innerHTML = `
      <button id="a"></button>
      <button id="b" aria-hidden="true"></button>
      <button id="c"></button>
    `;

    const ids = focusablesIn(document).map(el => el.id);

    expect(ids).toEqual(['a', 'c']);
  });

  it('excludes a control whose ANCESTOR carries aria-hidden="true", even though the control itself does not', () => {
    document.body.innerHTML = `
      <button id="a"></button>
      <div aria-hidden="true"><button id="hidden-child"></button></div>
    `;

    const ids = focusablesIn(document).map(el => el.id);

    expect(ids).toEqual(['a']);
  });

  it('does not exclude aria-hidden="false"', () => {
    document.body.innerHTML = `<button id="a" aria-hidden="false"></button>`;

    expect(focusablesIn(document).map(el => el.id)).toEqual(['a']);
  });
});

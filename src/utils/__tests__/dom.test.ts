/**
 * Vitest suite over `focusablesIn` — the shared tabbable-candidate filter `useFocusTrap` and
 * `keySimulation`'s Tab simulation both run, so they can't re-diverge the way they once had (the
 * widget's own focus trap skipped `aria-hidden` controls while the host-page Tab simulation did not).
 * Pins the WAI-ARIA-spec-correct behaviour: `aria-hidden="true"` removes an element from the
 * accessibility tree, and removes its whole subtree even when a descendant control carries no
 * `aria-hidden` of its own. The `offsetParent` override is load-bearing: jsdom does no layout, so every
 * element reports `offsetParent === null` and the visibility filter would drop the entire tab order.
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

/**
 * `getNearestCornerByTranslation` picks the corner a drag lands on from every start, keeps the corner
 * on a barely-moved drag, and snaps by proximity rather than axis; `isWidgetPosition` admits the four
 * corners and rejects inherited object property names.
 */
import { describe, expect, it } from 'vitest';

import type { WidgetPosition } from '../types';
import { getAnchorTopLeft, getNearestCornerByTranslation, isWidgetPosition } from './widgetPositioning';

const CORNERS: WidgetPosition[] = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
const [VW, VH, W, H] = [1280, 800, 56, 56];

describe('getNearestCornerByTranslation', () => {
  it('picks the corner the drag actually lands on, from every starting corner', () => {
    for (const from of CORNERS) {
      const start = getAnchorTopLeft(from, VW, VH, W, H);
      for (const to of CORNERS) {
        const target = getAnchorTopLeft(to, VW, VH, W, H);
        const translation = { dx: target.x - start.x, dy: target.y - start.y };
        expect(getNearestCornerByTranslation(translation, from, VW, VH, W, H)).toBe(to);
      }
    }
  });

  it('keeps the current corner when the drag barely moves', () => {
    for (const from of CORNERS) {
      expect(getNearestCornerByTranslation({ dx: 3, dy: -3 }, from, VW, VH, W, H)).toBe(from);
    }
  });

  it('snaps by proximity, not by axis', () => {
    expect(getNearestCornerByTranslation({ dx: -900, dy: -600 }, 'bottom_right', VW, VH, W, H)).toBe('top_left');
    expect(getNearestCornerByTranslation({ dx: 0, dy: -600 }, 'bottom_right', VW, VH, W, H)).toBe('top_right');
    expect(getNearestCornerByTranslation({ dx: 900, dy: 0 }, 'bottom_left', VW, VH, W, H)).toBe('bottom_right');
  });
});

describe('isWidgetPosition', () => {
  it('admits the four corners', () => {
    for (const position of CORNERS) expect(isWidgetPosition(position)).toBe(true);
  });

  it('rejects the names every object inherits, which no corner is', () => {
    const inherited = ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf'];
    for (const name of inherited) expect(isWidgetPosition(name)).toBe(false);
    expect(isWidgetPosition('bogus')).toBe(false);
    expect(isWidgetPosition(null)).toBe(false);
  });
});

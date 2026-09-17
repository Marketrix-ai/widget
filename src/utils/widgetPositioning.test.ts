/**
 * `getNearestCornerByTranslation` picks the corner a drag lands on from every start, keeps the corner
 * on a barely-moved drag, snaps by proximity rather than axis, and on an exact tie keeps the first
 * corner checked rather than the last; `getResizeGrip` grows away from the pinned corner on both axes
 * and picks the diagonal the grip cursor lies on; `isWidgetPosition` admits the four corners and rejects
 * inherited object property names. The tie-break case uses the viewport center, which is equidistant
 * from all four anchors, so a `<=` comparison instead of `<` would keep overwriting the winner and
 * report the last corner checked, not the nearest.
 */
import { describe, expect, it } from 'bun:test';

import type { WidgetPosition } from '../types';
import { getAnchorTopLeft, getNearestCornerByTranslation, getResizeGrip, isWidgetPosition } from './widgetPositioning';

const CORNERS: WidgetPosition[] = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
const [VW, VH, W, H] = [1280, 800, 56, 56];

describe('getResizeGrip', () => {
  it('grips the corner diagonally opposite the pinned one, growing away from the anchor', () => {
    expect(getResizeGrip('bottom_right')).toEqual({
      vertical: 'top',
      horizontal: 'left',
      growX: -1,
      growY: -1,
      cursor: 'nwse-resize',
    });
    expect(getResizeGrip('top_left')).toEqual({
      vertical: 'bottom',
      horizontal: 'right',
      growX: 1,
      growY: 1,
      cursor: 'nwse-resize',
    });
    expect(getResizeGrip('top_right')).toEqual({
      vertical: 'bottom',
      horizontal: 'left',
      growX: -1,
      growY: 1,
      cursor: 'nesw-resize',
    });
    expect(getResizeGrip('bottom_left')).toEqual({
      vertical: 'top',
      horizontal: 'right',
      growX: 1,
      growY: -1,
      cursor: 'nesw-resize',
    });
  });
});

describe('getNearestCornerByTranslation', () => {
  it('breaks an exact four-way distance tie toward the first corner in iteration order', () => {
    const start = getAnchorTopLeft('top_left', VW, VH, W, H);
    const center = { x: VW / 2 - W / 2, y: VH / 2 - H / 2 };
    const translation = { dx: center.x - start.x, dy: center.y - start.y };

    expect(getNearestCornerByTranslation(translation, 'top_left', VW, VH, W, H)).toBe('bottom_right');
  });

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

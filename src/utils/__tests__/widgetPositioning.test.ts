/**
 * Tests for the corner geometry: `getResizeGrip` grows away from the pinned corner, and `getReleaseCorner`
 * with no flick snaps a drag to the nearest corner, breaking an exact tie toward the first corner checked.
 */
import { describe, expect, it } from 'bun:test';

import type { WidgetPosition } from '../../types';
import { getAnchorTopLeft, getReleaseCorner, getResizeGrip } from '../widgetPositioning';

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

describe('getReleaseCorner', () => {
  it('breaks an exact four-way distance tie toward the first corner in iteration order', () => {
    const start = getAnchorTopLeft('top_left', VW, VH, W, H);
    const center = { x: VW / 2 - W / 2, y: VH / 2 - H / 2 };
    const translation = { dx: center.x - start.x, dy: center.y - start.y };

    expect(getReleaseCorner([], translation, 'top_left', VW, VH, W, H)).toBe('bottom_left');
  });

  it('picks the corner the drag actually lands on, from every starting corner', () => {
    for (const from of CORNERS) {
      const start = getAnchorTopLeft(from, VW, VH, W, H);
      for (const to of CORNERS) {
        const target = getAnchorTopLeft(to, VW, VH, W, H);
        const translation = { dx: target.x - start.x, dy: target.y - start.y };
        expect(getReleaseCorner([], translation, from, VW, VH, W, H)).toBe(to);
      }
    }
  });

  it('keeps the current corner when the drag barely moves', () => {
    for (const from of CORNERS) {
      expect(getReleaseCorner([], { dx: 3, dy: -3 }, from, VW, VH, W, H)).toBe(from);
    }
  });

  it('snaps by proximity, not by axis', () => {
    expect(getReleaseCorner([], { dx: -900, dy: -600 }, 'bottom_right', VW, VH, W, H)).toBe('top_left');
    expect(getReleaseCorner([], { dx: 0, dy: -600 }, 'bottom_right', VW, VH, W, H)).toBe('top_right');
    expect(getReleaseCorner([], { dx: 900, dy: 0 }, 'bottom_left', VW, VH, W, H)).toBe('bottom_right');
  });
});

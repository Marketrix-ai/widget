/**
 * Corner geometry for the widget: the four pinnable corners, the CSS offsets that place launcher and
 * panel at one, the resize grip each corner implies, and the drag-snap math.
 *
 * `getCorner` maps a `WidgetPosition` to its `{vertical, horizontal}` CSS sides. `isWidgetPosition`
 * narrows an unknown — a value read back out of localStorage — to one of the four, testing a list of
 * names rather than `in CORNERS`, so the keys every object inherits (`toString`, `__proto__`) are
 * rejected. `getPanelPositionStyle` turns a corner into the inline style pinning an element to it.
 * `getResizeGrip` describes the handle on the corner
 * diagonally OPPOSITE the pinned one — the panel grows away from its anchor, so that is the only
 * corner free to move; `growX`/`growY` are the signs converting pointer delta into size delta, and
 * `cursor` is the diagonal the grip itself lies on. `getAnchorTopLeft` resolves a corner to viewport
 * top-left pixels so drag math runs in one coordinate space, and `getNearestCornerByTranslation` adds
 * a drag's translation to that anchor and returns the corner whose own anchor is nearest by
 * straight-line distance — proximity, never per-axis resolution.
 *
 * EDGE_OFFSET_PX is the one edge offset: launcher and panel both position through
 * `getPanelPositionStyle`, so there is no second declaration to drift from — it used to be pinned
 * against a Tailwind class string.
 */
import type React from 'react';

import type { WidgetPosition } from '../types';

const EDGE_OFFSET_PX = 20;

const CORNERS = {
  bottom_right: { vertical: 'bottom', horizontal: 'right' },
  bottom_left: { vertical: 'bottom', horizontal: 'left' },
  top_right: { vertical: 'top', horizontal: 'right' },
  top_left: { vertical: 'top', horizontal: 'left' },
} as const;

const CORNER_NAMES = Object.keys(CORNERS) as WidgetPosition[];

export const getCorner = (position: WidgetPosition) => CORNERS[position];

export const isWidgetPosition = (value: unknown): value is WidgetPosition =>
  CORNER_NAMES.includes(value as WidgetPosition);

export const getPanelPositionStyle = (position: WidgetPosition): React.CSSProperties => {
  const { vertical, horizontal } = getCorner(position);
  return { [vertical]: `${EDGE_OFFSET_PX}px`, [horizontal]: `${EDGE_OFFSET_PX}px` };
};

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;

export const getResizeGrip = (position: WidgetPosition) => {
  const pinned = getCorner(position);
  const vertical = OPPOSITE[pinned.vertical];
  const horizontal = OPPOSITE[pinned.horizontal];
  return {
    vertical,
    horizontal,
    growX: horizontal === 'left' ? -1 : 1,
    growY: vertical === 'top' ? -1 : 1,
    cursor: (vertical === 'top') === (horizontal === 'left') ? 'nwse-resize' : 'nesw-resize',
  };
};

export const getAnchorTopLeft = (
  position: WidgetPosition,
  vw: number,
  vh: number,
  w: number,
  h: number,
): { x: number; y: number } => {
  const { vertical, horizontal } = getCorner(position);
  return {
    x: horizontal === 'left' ? EDGE_OFFSET_PX : vw - EDGE_OFFSET_PX - w,
    y: vertical === 'top' ? EDGE_OFFSET_PX : vh - EDGE_OFFSET_PX - h,
  };
};

export const getNearestCornerByTranslation = (
  translation: { dx: number; dy: number },
  position: WidgetPosition,
  vw: number,
  vh: number,
  w: number,
  h: number,
): WidgetPosition => {
  const anchor = getAnchorTopLeft(position, vw, vh, w, h);
  const x = anchor.x + translation.dx;
  const y = anchor.y + translation.dy;

  let nearest: WidgetPosition = position;
  let minDist = Infinity;
  for (const candidate of CORNER_NAMES) {
    const target = getAnchorTopLeft(candidate, vw, vh, w, h);
    const dist = Math.hypot(x - target.x, y - target.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = candidate;
    }
  }
  return nearest;
};

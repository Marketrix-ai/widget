import type React from 'react';

import type { WidgetPosition } from '../types';

// The one edge offset. Launcher and panel both position through getPanelPositionStyle, so there is
// no second declaration to drift from — this used to be pinned against a Tailwind class string.
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

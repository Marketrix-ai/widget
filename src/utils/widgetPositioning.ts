import type React from 'react';

import type { WidgetPosition } from '../types';

// Must equal Tailwind's `-5` (1.25rem) in the class strings: the launcher positions by class, the panel by inline style.
const EDGE_OFFSET_PX = 20;

// Class strings are spelled out because Tailwind only emits what it can see literally in the source.
const CORNERS = {
  bottom_right: { classes: 'bottom-5 right-5', vertical: 'bottom', horizontal: 'right' },
  bottom_left: { classes: 'bottom-5 left-5', vertical: 'bottom', horizontal: 'left' },
  top_right: { classes: 'top-5 right-5', vertical: 'top', horizontal: 'right' },
  top_left: { classes: 'top-5 left-5', vertical: 'top', horizontal: 'left' },
} as const;

export const getCorner = (position: WidgetPosition) => CORNERS[position] ?? CORNERS.bottom_right;

export const isWidgetPosition = (value: unknown): value is WidgetPosition =>
  typeof value === 'string' && value in CORNERS;

export const getPositionClasses = (position: WidgetPosition): string => getCorner(position).classes;

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
  for (const candidate of Object.keys(CORNERS) as WidgetPosition[]) {
    const target = getAnchorTopLeft(candidate, vw, vh, w, h);
    const dist = Math.hypot(x - target.x, y - target.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = candidate;
    }
  }
  return nearest;
};

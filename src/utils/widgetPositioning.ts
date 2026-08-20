import type React from 'react';

import type { WidgetPosition } from '../types';

// Must equal Tailwind's `-5` (1.25rem) in getPositionClasses: launcher positions by class, panel by inline style.
const EDGE_OFFSET_PX = 20;

export const getPositionClasses = (position: WidgetPosition): string => {
  switch (position) {
    case 'bottom_right':
      return 'bottom-5 right-5';
    case 'bottom_left':
      return 'bottom-5 left-5';
    case 'top_right':
      return 'top-5 right-5';
    case 'top_left':
      return 'top-5 left-5';
    default:
      return 'bottom-5 right-5';
  }
};

export const getPanelPositionStyle = (position: WidgetPosition): React.CSSProperties => {
  const primary = `${EDGE_OFFSET_PX}px`;
  const secondary = `${EDGE_OFFSET_PX}px`;
  switch (position) {
    case 'bottom_right':
      return { bottom: primary, right: secondary };
    case 'bottom_left':
      return { bottom: primary, left: secondary };
    case 'top_right':
      return { top: primary, right: secondary };
    case 'top_left':
      return { top: primary, left: secondary };
    default:
      return { bottom: primary, right: secondary };
  }
};

export const getAnchorTopLeft = (
  position: WidgetPosition,
  vw: number,
  vh: number,
  w: number,
  h: number,
): { x: number; y: number } => {
  switch (position) {
    case 'top_left':
      return { x: EDGE_OFFSET_PX, y: EDGE_OFFSET_PX };
    case 'top_right':
      return { x: vw - EDGE_OFFSET_PX - w, y: EDGE_OFFSET_PX };
    case 'bottom_left':
      return { x: EDGE_OFFSET_PX, y: vh - EDGE_OFFSET_PX - h };
    case 'bottom_right':
    default:
      return { x: vw - EDGE_OFFSET_PX - w, y: vh - EDGE_OFFSET_PX - h };
  }
};

export const getNearestCornerByTranslation = (
  translation: { dx: number; dy: number },
  position: WidgetPosition,
  vw: number,
  vh: number,
  w: number,
  h: number,
): WidgetPosition => {
  const corners: WidgetPosition[] = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
  const anchor = getAnchorTopLeft(position, vw, vh, w, h);
  const x = anchor.x + translation.dx;
  const y = anchor.y + translation.dy;
  let nearest: WidgetPosition = position;
  let minDist = Infinity;
  for (const corner of corners) {
    const target = getAnchorTopLeft(corner, vw, vh, w, h);
    const dist = Math.hypot(x - target.x, y - target.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = corner;
    }
  }
  return nearest;
};

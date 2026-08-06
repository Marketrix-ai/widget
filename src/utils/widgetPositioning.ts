import type React from 'react';

import type { WidgetPosition } from '../types';

// Must equal Tailwind's `-5` spacing (1.25rem) used by getPositionClasses — the launcher is placed
// by class, the panel by inline style, and the two must land on the same edge offset.
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

/** Anchored to the same corner as the launcher button. */
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

/** Measured center-to-center, not top-left-to-top-left. */
const getDeltaToCorner = (
  position: WidgetPosition,
  corner: WidgetPosition,
  vw: number,
  vh: number,
  w: number,
  h: number,
): { dx: number; dy: number } => {
  const anchor = getAnchorTopLeft(position, vw, vh, w, h);
  const centerX = anchor.x + w / 2;
  const centerY = anchor.y + h / 2;

  let targetCenterX: number;
  let targetCenterY: number;
  switch (corner) {
    case 'top_left':
      targetCenterX = EDGE_OFFSET_PX + w / 2;
      targetCenterY = EDGE_OFFSET_PX + h / 2;
      break;
    case 'top_right':
      targetCenterX = vw - EDGE_OFFSET_PX - w / 2;
      targetCenterY = EDGE_OFFSET_PX + h / 2;
      break;
    case 'bottom_left':
      targetCenterX = EDGE_OFFSET_PX + w / 2;
      targetCenterY = vh - EDGE_OFFSET_PX - h / 2;
      break;
    case 'bottom_right':
    default:
      targetCenterX = vw - EDGE_OFFSET_PX - w / 2;
      targetCenterY = vh - EDGE_OFFSET_PX - h / 2;
      break;
  }

  return {
    dx: targetCenterX - centerX,
    dy: targetCenterY - centerY,
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
  const corners: WidgetPosition[] = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
  let nearest: WidgetPosition = position;
  let minDist = Infinity;
  for (const corner of corners) {
    const target = getDeltaToCorner(position, corner, vw, vh, w, h);
    const dist = Math.hypot(translation.dx - target.dx, translation.dy - target.dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = corner;
    }
  }
  return nearest;
};

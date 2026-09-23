/**
 * Corner geometry for the widget: the four pinnable corners, the offsets that place the launcher and
 * panel there, the resize grip each corner implies, and the drag-snap math.
 *
 * `getCorner` and `isWidgetPosition` map a `WidgetPosition` to its CSS sides and narrow a stored value
 * back to one. `getPanelPositionStyle` turns a corner into inline style. `getResizeGrip` describes the
 * handle on the opposite corner, since the panel grows away from its anchor. `getAnchorTopLeft` and
 * `getNearestCornerByTranslation` do the drag math, snapping a drag to whichever corner ends up nearest.
 */
import type React from 'react';

import { WidgetSettingsDataSchema } from '../sdk/contracts/widgetSettings';
import type { WidgetPosition } from '../types';

const EDGE_OFFSET_PX = 20;

const CORNERS = {
  bottom_right: { vertical: 'bottom', horizontal: 'right' },
  bottom_left: { vertical: 'bottom', horizontal: 'left' },
  top_right: { vertical: 'top', horizontal: 'right' },
  top_left: { vertical: 'top', horizontal: 'left' },
} as const;

export const getCorner = (position: WidgetPosition) => CORNERS[position];

export const isWidgetPosition = (value: unknown): value is WidgetPosition =>
  typeof value === 'string' && Object.hasOwn(CORNERS, value);

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
  for (const candidate of WidgetSettingsDataSchema.shape.widget_position.options) {
    const target = getAnchorTopLeft(candidate, vw, vh, w, h);
    const dist = Math.hypot(x - target.x, y - target.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = candidate;
    }
  }
  return nearest;
};

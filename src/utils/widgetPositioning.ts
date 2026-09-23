/**
 * Corner geometry for the widget: the four pinnable corners, the offsets that place the launcher and
 * panel there, the resize grip each corner implies, and the drag-snap math.
 *
 * `getCorner` maps a `WidgetPosition` to its CSS sides and `EDGE_OFFSET_PX` is the gap from those edges.
 * `getPanelPositionStyle` turns a corner into inline style. `getResizeGrip` describes the
 * handle on the opposite corner, since the panel grows away from its anchor. `getAnchorTopLeft` and
 * `getNearestCornerByTranslation` do the drag math, `getReleaseCorner` adds a flick's projected momentum
 * to it, and `animateSnap` glides the launcher to the chosen corner and reports when it lands.
 */
import type React from 'react';

import { WidgetSettingsDataSchema } from '../sdk/contracts/widgetSettings';
import type { WidgetPosition } from '../types';

export const EDGE_OFFSET_PX = 20;

const CORNERS = {
  bottom_right: { vertical: 'bottom', horizontal: 'right' },
  bottom_left: { vertical: 'bottom', horizontal: 'left' },
  top_right: { vertical: 'top', horizontal: 'right' },
  top_left: { vertical: 'top', horizontal: 'left' },
} as const;

export const getCorner = (position: WidgetPosition) => CORNERS[position];

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

export type PointerSample = { x: number; y: number; t: number };

const SNAP_DURATION_MS = 600;
const SNAP_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

const projectFlickVelocity = (history: PointerSample[], decel = 0.999): { x: number; y: number } => {
  const first = history[0];
  const last = history[history.length - 1];
  const dt = first && last ? last.t - first.t : 0;
  if (!first || !last || dt <= 0) return { x: 0, y: 0 };
  const project = (d: number) => ((d / dt) * decel) / (1 - decel);
  return { x: project(last.x - first.x), y: project(last.y - first.y) };
};

export const getReleaseCorner = (
  history: PointerSample[],
  translation: { dx: number; dy: number },
  position: WidgetPosition,
  vw: number,
  vh: number,
  w: number,
  h: number,
): WidgetPosition => {
  const flick = projectFlickVelocity(history);
  return getNearestCornerByTranslation(
    { dx: translation.dx + flick.x, dy: translation.dy + flick.y },
    position,
    vw,
    vh,
    w,
    h,
  );
};

export const animateSnap = (
  wrapper: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  onSettled: () => void,
): (() => void) => {
  let finished = false;
  const detach = () => {
    finished = true;
    window.clearTimeout(fallbackTimer);
    wrapper.removeEventListener('transitionend', onEnd);
  };
  const done = () => {
    if (finished) return;
    detach();
    wrapper.style.transition = 'none';
    wrapper.style.willChange = '';
    wrapper.style.left = '';
    wrapper.style.top = '';
    onSettled();
    requestAnimationFrame(() => {
      wrapper.style.transition = '';
    });
  };
  const onEnd = (e: TransitionEvent) => {
    if (e.target === wrapper && e.propertyName === 'left') done();
  };
  const fallbackTimer = window.setTimeout(done, SNAP_DURATION_MS + 50);
  wrapper.addEventListener('transitionend', onEnd);
  wrapper.style.transition = 'none';
  wrapper.style.transform = 'none';
  wrapper.style.willChange = 'left, top';
  wrapper.style.left = `${from.x}px`;
  wrapper.style.top = `${from.y}px`;
  requestAnimationFrame(() => {
    wrapper.style.transition = `left ${SNAP_DURATION_MS}ms ${SNAP_EASING}, top ${SNAP_DURATION_MS}ms ${SNAP_EASING}`;
    wrapper.style.left = `${to.x}px`;
    wrapper.style.top = `${to.y}px`;
  });
  return detach;
};

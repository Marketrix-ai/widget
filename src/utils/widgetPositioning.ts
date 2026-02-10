import type { WidgetPosition } from '../types';

export const getPositionClasses = (position: WidgetPosition): string => {
  // Use exact positioning for precise widget placement
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

export const getCornerInlineStyle = (
  position: WidgetPosition,
  offsetPx = 20,
): {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
} => {
  const offset = `${offsetPx}px`;
  switch (position) {
    case 'top_left':
      return { top: offset, left: offset };
    case 'top_right':
      return { top: offset, right: offset };
    case 'bottom_left':
      return { bottom: offset, left: offset };
    case 'bottom_right':
    default:
      return { bottom: offset, right: offset };
  }
};

export const getNearestCorner = (
  x: number,
  y: number,
  bounds: { left: number; top: number; width: number; height: number },
): WidgetPosition => {
  const midX = bounds.left + bounds.width / 2;
  const midY = bounds.top + bounds.height / 2;
  const isRight = x >= midX;
  const isBottom = y >= midY;

  if (isBottom && isRight) return 'bottom_right';
  if (isBottom && !isRight) return 'bottom_left';
  if (!isBottom && isRight) return 'top_right';
  return 'top_left';
};

import type { WidgetPosition } from '../types';

export const getPositionClasses = (position: WidgetPosition): string => {
  // Use exact positioning for precise widget placement
  switch (position) {
    case 'bottom_right':
      return 'bottom-5 right-5';
    case 'bottom_left':
      return 'bottom-5 left-5';
    default:
      return 'bottom-5 right-5';
  }
};

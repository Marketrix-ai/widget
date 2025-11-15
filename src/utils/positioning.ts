import type { WidgetPosition } from '../types';

// Check if screen sharing is in full-screen mode
export const isFullScreenMode = (): boolean => {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
};

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

export const getWidgetContainerClasses = (position: WidgetPosition): string => {
  const baseClasses = 'marketrix-widget-container';
  const positionClasses = getPositionClasses(position);
  return `${baseClasses} ${positionClasses}`;
};

export const getChatWindowClasses = (position: WidgetPosition): string => {
  const baseClasses =
    'bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700';
  const sizeClasses = 'w-[360px] max-w-sm';

  // Use consistent positioning with 5px spacing for full widget display
  let positionClasses = '';
  switch (position) {
    case 'bottom_right':
      positionClasses = 'bottom-16 right-5';
      break;
    case 'bottom_left':
      positionClasses = 'bottom-16 left-5';
      break;
  }

  return `${baseClasses} ${sizeClasses} ${positionClasses}`;
};

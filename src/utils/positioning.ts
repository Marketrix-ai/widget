import { WidgetPosition } from '../types';

export const getPositionClasses = (position: WidgetPosition): string => {
  switch (position) {
    case 'bottom-right':
      return 'bottom-4 right-4';
    case 'bottom-left':
      return 'bottom-4 left-4';
    case 'top-right':
      return 'top-4 right-4';
    case 'top-left':
      return 'top-4 left-4';
    default:
      return 'bottom-4 right-4';
  }
};

export const getWidgetContainerClasses = (position: WidgetPosition): string => {
  const baseClasses = 'marketrix-widget-container';
  const positionClasses = getPositionClasses(position);
  return `${baseClasses} ${positionClasses}`;
};

export const getChatWindowClasses = (position: WidgetPosition): string => {
  const baseClasses = 'bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700';
  const sizeClasses = 'w-80 max-w-sm';
  
  let positionClasses = '';
  switch (position) {
    case 'bottom-right':
      positionClasses = 'bottom-16 right-0';
      break;
    case 'bottom-left':
      positionClasses = 'bottom-16 left-0';
      break;
    case 'top-right':
      positionClasses = 'top-16 right-0';
      break;
    case 'top-left':
      positionClasses = 'top-16 left-0';
      break;
  }
  
  return `${baseClasses} ${sizeClasses} ${positionClasses}`;
};

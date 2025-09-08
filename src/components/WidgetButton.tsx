import React from 'react';
import { MarketrixConfig } from '../types';
import { getPositionClasses } from '../utils/positioning';

interface WidgetButtonProps {
  config: MarketrixConfig;
  onClick: () => void;
  isOpen: boolean;
  agentAvailable: boolean;
}

export const WidgetButton: React.FC<WidgetButtonProps> = ({
  config,
  onClick,
  isOpen,
  agentAvailable,
}) => {
  const positionClasses = getPositionClasses(config.position || 'bottom-right');
  const theme = config.theme || 'light';
  
  const isDark = theme === 'dark';
  
  return (
    <div className={`fixed ${positionClasses} z-50`}>
      <button
        onClick={onClick}
        className={`
          relative w-14 h-14 rounded-full shadow-lg transition-all duration-300 ease-in-out
          ${isDark 
            ? 'bg-gray-800 hover:bg-gray-700 text-white' 
            : 'bg-white hover:bg-gray-50 text-gray-800'
          }
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 hover:scale-110'}
          border-2 ${isDark ? 'border-gray-600' : 'border-gray-200'}
          focus:outline-none focus:ring-4 focus:ring-marketrix-500/20
        `}
        aria-label="Open Marketrix support chat"
      >
        {/* Avatar or Logo */}
        <div className="w-full h-full flex items-center justify-center">
          {config.avatarUrl ? (
            <img
              src={config.avatarUrl}
              alt={config.agentName || 'Support Agent'}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                // Fallback to default icon if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          
          {/* Default icon (shown if no avatar or as fallback) */}
          <svg
            className={`w-6 h-6 ${config.avatarUrl ? 'hidden' : ''}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>

        {/* Online indicator */}
        {agentAvailable && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        )}

        {/* Notification badge */}
        {!isOpen && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-bounce">
            1
          </div>
        )}
      </button>

      {/* Tooltip */}
      {!isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {config.agentName || 'Support Agent'}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

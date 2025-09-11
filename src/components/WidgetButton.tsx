import React, { useState, useEffect } from 'react';
import { MarketrixConfig } from '../types';
import { getPositionClasses } from '../utils/positioning';
import MarketrixIcon from '../assets/marketrix-Icon.png';

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
  const [showWelcomeText, setShowWelcomeText] = useState(false);
  
  const isDark = theme === 'dark';

  // Show welcome text after 2 seconds when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcomeText(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className={`fixed ${positionClasses} z-50 transition-all duration-500 ease-in-out ${showWelcomeText && !isOpen ? 'transform -translate-x-64' : ''}`}>
      <button
        onClick={onClick}
        className={`
          relative w-14 h-14 rounded-[27px] gradient-border transition-all duration-300 ease-in-out
          ${isDark 
            ? 'bg-gray-800 hover:bg-gray-700 text-white' 
            : 'bg-transparent hover:bg-gray-50 text-gray-800'
          }
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 hover:scale-110'}
          border-2 ${isDark ? 'border-gray-600' : 'border-transparent'}
          focus:outline-none focus:ring-4 focus:ring-marketrix-500/20
        `}
        aria-label="Open Marketrix support chat"
      >
        {/* Avatar or Logo */}
        <div className="w-full h-full flex items-center">
          {config.avatarUrl ? (
            <img
              src={config.avatarUrl}
              alt={config.agentName || 'Support Agent'}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to default icon if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          
          {/* Default Marketrix icon */}
          
          <div className="w-full h-full bg-black rounded flex items-center justify-center">
                <img src={MarketrixIcon} alt="Marketrix Icon" className="w-12 h-12" />
              </div>
          </div>

        {/* Online indicator */}
        {agentAvailable && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

       {/* Welcome Text - appears after 2 seconds */}
       {!isOpen && showWelcomeText && (
         <div className="absolute left-16 top-1/2 transform -translate-y-1/2 px-4 py-3 bg-white text-gray-800 text-sm rounded-lg shadow-lg w-64 gradient-border animate-slide-in-left">
           <div className="flex items-center gap-2">
             <div>
               <div className="font-medium">Hey! 👋 I'm Marketrix AI</div>
               <div className="text-gray-600">How can I help you?</div>
             </div>
           </div>
           <div className="absolute top-1/2 right-full transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-white" />
         </div>
       )}

      {/* Tooltip */}
      {!isOpen && !showWelcomeText && (
        <div className="absolute bottom-16 right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {config.agentName || 'Support Agent'}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

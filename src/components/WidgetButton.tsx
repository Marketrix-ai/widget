import React, { useEffect, useState } from 'react';

import MarketrixIcon from '../assets/marketrix-icon.png';
import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig } from '../types';
import { getPositionClasses } from '../utils/widgetPositioning';

interface WidgetButtonProps {
  config: MarketrixConfig;
  onClick: () => void;
  isOpen: boolean;
  _agentAvailable: boolean;
  _isScreenSharing?: boolean;
}

export const WidgetButton: React.FC<WidgetButtonProps> = ({ config, onClick, isOpen }) => {
  const theme = config.theme || 'light';
  const [showWelcomeText, setShowWelcomeText] = useState(false);

  // Get atmosphere configuration
  const { getWidgetText, getWidgetPosition, settings } = useWidget({ config });
  const widgetText = getWidgetText();
  const widgetPosition = getWidgetPosition();

  const isDark = theme === 'dark';

  // Show welcome text after 2 seconds when component mounts (only for default appearance)
  useEffect(() => {
    // Ensure button shows immediately
    setShowWelcomeText(false);

    // Only show welcome text for default appearance, not compact
    if (settings.widget_appearance === 'default') {
      // Add a small delay to ensure button renders first
      const buttonTimer = setTimeout(() => {
        // Button is now visible, start welcome text timer
        const welcomeTimer = setTimeout(() => {
          setShowWelcomeText(true);
        }, 2000);

        return () => clearTimeout(welcomeTimer);
      }, 100);

      return () => clearTimeout(buttonTimer);
    }
  }, [settings.widget_appearance]);

  // Use position from widget position config or settings
  const effectivePosition = widgetPosition.position || settings.widget_position || 'bottom_right';
  const effectivePositionClasses = getPositionClasses(effectivePosition);

  return (
    <div
      className={`fixed ${effectivePositionClasses} transition-all duration-500 ease-in-out ${showWelcomeText && !isOpen ? (effectivePosition.includes('left') ? 'transform translate-x-64' : 'transform -translate-x-64') : ''}`}
      style={{ zIndex: widgetPosition.z_index || 50 }}
    >
      <button
        onClick={onClick}
        className={`
          relative w-14 h-14 rounded-[27px] transition-all duration-300 ease-in-out
          ${isDark ? 'bg-[#101828] text-white' : 'text-gray-800'}
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 hover:scale-110'}
          border-2 ${isDark ? 'border-gray-600' : 'border-transparent'}
        `}
        aria-label='Open Marketrix support chat'
      >
        {/* Logo/Icon */}
        <div className='w-full h-full flex items-center justify-center'>
          <div className='w-full h-full bg-[#101828] rounded flex items-center justify-center'>
            <img src={MarketrixIcon} alt='Marketrix Icon' className='w-fit h-12' />
          </div>
        </div>
      </button>

      {/* Welcome Text - appears after 2 seconds (only for default appearance) */}
      {!isOpen && showWelcomeText && settings.widget_appearance === 'default' && (
        <div
          className={`absolute ${effectivePosition.includes('left') ? 'right-16' : 'left-16'} top-1/2 transform -translate-y-1/2 px-4 py-3 bg-white text-gray-800 text-sm rounded-lg shadow-lg w-64 gradient-border ${effectivePosition.includes('left') ? 'animate-slide-in-right' : 'animate-slide-in-left'} cursor-pointer`}
          onClick={onClick}
        >
          <div className='flex gap-2'>
            {/* Close button - show first for bottom_left position */}
            {effectivePosition.includes('left') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWelcomeText(false);
                }}
                className='flex-shrink-0 w-4 h-4 flex align-top justify-start rounded-full hover:bg-gray-100 transition-colors duration-200'
                aria-label='Close welcome message'
              >
                <svg
                  className='w-full h-full text-gray-500 border-2 border-gray-500 rounded-full p-0.1'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            )}

            {/* greeting text */}
            <div className='flex-1'>
              <div className='font-medium'>
                {settings.widget_greeting || widgetText.greeting || "Hey! 👋 I'm Marketrix AI"}
              </div>
              <div className='text-gray-600'>
                {settings.widget_body || widgetText.chat_greeting || 'How can I help you?'}
              </div>
            </div>

            {/* Close button - show last for bottom_right position */}
            {effectivePosition.includes('right') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWelcomeText(false);
                }}
                className='flex-shrink-0 w-4 h-4 flex align-top justify-start rounded-full hover:bg-gray-100 transition-colors duration-200'
                aria-label='Close welcome message'
              >
                <svg
                  className='w-full h-full text-gray-500 border-2 border-gray-500 rounded-full p-0.1'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            )}
          </div>
          <div
            className={`absolute top-1/2 ${effectivePosition.includes('left') ? 'left-full' : 'right-full'} transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 ${effectivePosition.includes('left') ? 'border-l-4 border-transparent border-l-white' : 'border-r-4 border-transparent border-r-white'}`}
          />
        </div>
      )}

      {/* Tooltip - show when welcome text is not displayed */}
      {!isOpen && (!showWelcomeText || settings.widget_appearance === 'compact') && (
        <div
          className={`absolute bottom-16 ${effectivePosition.includes('left') ? 'left-0' : 'right-0'} mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
        >
          {'Support Agent'}
          <div
            className={`absolute top-full ${effectivePosition.includes('left') ? 'left-4' : 'right-4'} w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900`}
          />
        </div>
      )}
    </div>
  );
};

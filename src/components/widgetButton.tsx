import React, { useEffect, useState } from 'react';

import MarketrixIcon from '../assets/marketrix-icon.png';
import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig } from '../types';
import { addOpacity, darkenColor, getContrastingColor } from '../utils/colorUtils';
import { getPositionClasses } from '../utils/widgetPositioning';

interface WidgetButtonProps {
  config: MarketrixConfig;
  onClick: () => void;
  isOpen: boolean;
  isMinimized?: boolean;
  _agentAvailable: boolean;
  isScreenSharing?: boolean;
}

export const WidgetButton: React.FC<WidgetButtonProps> = ({
  config,
  onClick,
  isOpen,
  isMinimized = false,
  isScreenSharing = false,
}) => {
  const [showWelcomeText, setShowWelcomeText] = useState(false);
  const { getWidgetPosition, settings } = useWidget({ config });
  const widgetPosition = getWidgetPosition();

  useEffect(() => {
    setShowWelcomeText(false);

    // Don't show welcome text if widget is minimized
    if (isMinimized) {
      return;
    }

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
  }, [settings.widget_appearance, isMinimized]);

  // Use position from widget position config or settings
  const effectivePosition = (widgetPosition.position ||
    settings.widget_position ||
    'bottom_right') as 'bottom_left' | 'bottom_right';
  const effectivePositionClasses = getPositionClasses(effectivePosition);

  return (
    <div
      className={`fixed ${effectivePositionClasses} transition-transform duration-500 ease-in-out ${showWelcomeText && !isOpen ? (effectivePosition.includes('left') ? 'transform translate-x-64' : 'transform -translate-x-64') : ''}`}
      style={{ zIndex: widgetPosition.z_index || 50 }}
    >
      <button
        onClick={onClick}
        className={`
          relative w-14 h-14 rounded-[27px] transition-all duration-300 ease-in-out
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 hover:scale-110'}
          border-2 border-transparent
        `}
        style={{
          color: getContrastingColor(settings.widget_accent_color),
        }}
        aria-label='Open Marketrix support chat'
      >
        {/* Logo/Icon */}
        <div className='w-full h-full flex items-center justify-center relative'>
          <div
            className='w-full h-full rounded flex items-center justify-center'
            style={{ backgroundColor: 'transparent' }}
          >
            <img
              src={MarketrixIcon}
              alt='Marketrix Icon'
              className='w-fit h-12'
              style={{
                boxShadow: settings.widget_shadow,
                borderRadius: settings.widget_border_radius,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
              }}
            />
          </div>
          {/* Live indicator dot - show when screensharing and chat is closed */}
          {!isOpen && isScreenSharing && (
            <div className='absolute top-1 right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse border-2 border-white' />
          )}
        </div>
      </button>

      {/* Welcome Text - appears after 2 seconds (only for default appearance) */}
      {!isOpen && showWelcomeText && settings.widget_appearance === 'default' && (
        <div
          className={`absolute ${effectivePosition.includes('left') ? 'right-16' : 'left-16'} bottom-0 px-4 py-3 text-sm rounded-lg shadow-lg w-64 ${effectivePosition.includes('left') ? 'animate-slide-in-right' : 'animate-slide-in-left'} cursor-pointer`}
          style={{
            backgroundColor: '#ffffff',
            backgroundImage: 'none',
            color: settings.widget_text_color,
            borderColor: settings.widget_border_color,
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
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
              <div className='font-medium'>{settings.widget_greeting}</div>
              <div style={{ color: addOpacity(settings.widget_text_color, 0.7) }}>
                {settings.widget_body}
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
            className={`absolute bottom-0 ${effectivePosition.includes('left') ? 'left-full' : 'right-full'} transform translate-y-1/2 w-0 h-0 border-t-4 border-b-4`}
            style={{
              [effectivePosition.includes('left') ? 'borderLeftColor' : 'borderRightColor']:
                settings.widget_background_color,
              [effectivePosition.includes('left') ? 'borderRightColor' : 'borderLeftColor']:
                'transparent',
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
            }}
          />
        </div>
      )}

      {/* Tooltip - show when welcome text is not displayed */}
      {!isOpen && (!showWelcomeText || settings.widget_appearance === 'compact') && (
        <div
          className={`absolute bottom-16 ${effectivePosition.includes('left') ? 'left-0' : 'right-0'} mb-2 px-3 py-2 text-sm rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
          style={{
            backgroundColor: darkenColor(settings.widget_accent_color, 0.3),
            color: getContrastingColor(darkenColor(settings.widget_accent_color, 0.3)),
          }}
        >
          {'Support Agent'}
          <div
            className={`absolute top-full ${effectivePosition.includes('left') ? 'left-4' : 'right-4'} w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent`}
            style={{
              borderTopColor: darkenColor(settings.widget_accent_color, 0.3),
            }}
          />
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.png';
import { useWidget } from '../../hooks/useWidget';
import type { MarketrixConfig } from '../../types';
import { addOpacity, getContrastingColor } from '../../utils/format';
import { getPositionClasses } from '../../utils/widgetPositioning';

interface WidgetButtonProps {
  config: MarketrixConfig;
  onClick: () => void;
  isOpen: boolean;
  isMinimized?: boolean;
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
  const { config: widgetConfig, state: widgetState, isPreviewMode } = useWidget({ config });

  useEffect(() => {
    setShowWelcomeText(false);

    // Don't show welcome text if widget is minimized
    if (isMinimized) {
      return;
    }

    // Only show welcome text for default appearance, not compact
    if (widgetConfig.widget_appearance === 'default') {
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
  }, [widgetConfig.widget_appearance, isMinimized]);

  // Use position from config
  const effectivePosition = widgetConfig.widget_position as 'bottom_left' | 'bottom_right';
  const zIndex = widgetConfig.widget_position_z_index ?? 50;
  const effectivePositionClasses = getPositionClasses(effectivePosition);

  // Use absolute positioning in preview mode (container-relative), fixed in production (viewport-relative)
  const positionClass = isPreviewMode ? 'absolute' : 'fixed';

  // In preview mode, use inline styles for positioning to ensure it works in shadow DOM
  const previewPositionStyle = isPreviewMode
    ? {
        bottom: '20px', // equivalent to bottom-5 (1.25rem = 20px)
        ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }),
      }
    : {};

  return (
    <div
      className={`${positionClass} ${isPreviewMode ? '' : effectivePositionClasses} transition-transform duration-500 ease-in-out ${showWelcomeText && !isOpen ? (effectivePosition.includes('left') ? 'transform translate-x-64' : 'transform -translate-x-64') : ''}`}
      style={{
        zIndex,
        ...previewPositionStyle,
      }}
    >

      {/* URL Guide Message Chips - Displayed above button when exact URL match */}
      {!isOpen && widgetState.urlGuideMessages && widgetState.urlGuideMessages.length > 0 && (
        <div
          className={`
            absolute bottom-full mb-2 right-0
            flex flex-wrap items-end gap-1.5
            max-w-[280px]
            ${effectivePosition.includes('left') ? 'animate-slide-in-right' : 'animate-slide-in-left'}
          `}
          style={{
            justifyContent: effectivePosition.includes('right') ? 'flex-end' : 'flex-start',
          }}
        >
          {widgetState.urlGuideMessages.map((message, index) => {
            return (
              <div
                key={index}
                className={`
                  px-4 py-2 rounded-lg font-inter font-medium text-xs 
                  transition-all duration-200
                  whitespace-nowrap text-center
                  backdrop-blur-sm
                  w-auto
                `}
                style={{
                  backgroundColor: addOpacity(widgetConfig.widget_background_color || '#ffffff', 0.95),
                  color: widgetConfig.widget_text_color || '#374151',
                  borderColor: addOpacity(widgetConfig.widget_border_color || '#e5e7eb', 0.5),
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = addOpacity(widgetConfig.widget_background_color || '#ffffff', 1);
                  e.currentTarget.style.borderColor = addOpacity(widgetConfig.widget_border_color || '#e5e7eb', 0.8);
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = addOpacity(widgetConfig.widget_background_color || '#ffffff', 0.95);
                  e.currentTarget.style.borderColor = addOpacity(widgetConfig.widget_border_color || '#e5e7eb', 0.5);
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {message}
              </div>
            );
          })}
        </div>
      )}
      <button
        onClick={onClick}
        className={`
          relative w-14 h-14 rounded-[27px] transition-all duration-300 ease-in-out
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 hover:scale-110'}
          border-2 border-transparent
        `}
        style={{
          color: getContrastingColor(widgetConfig.widget_accent_color),
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
                boxShadow: widgetConfig.widget_shadow,
                borderRadius: widgetConfig.widget_border_radius,
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
    </div>
  );
};

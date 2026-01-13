import React from 'react';

import { addOpacity } from '../../utils/format';

interface UrlGuideBannerProps {
  message: string;
  settings: {
    widget_accent_color: string;
    widget_text_color: string;
    widget_background_color: string;
    widget_border_color: string;
    widget_secondary_color: string;
  };
  onClose?: () => void;
}

export const UrlGuideBanner: React.FC<UrlGuideBannerProps> = ({ message, settings, onClose }) => {
  return (
    <div className='w-full px-3 py-2.5 border-b' style={{ borderColor: settings.widget_border_color }}>
      <div
        className={`
          w-full flex items-center gap-2 font-inter font-semibold text-xs px-3 py-2.5 rounded-lg
          transition-all duration-200
          group
          leading-tight
          cursor-default
          hover:shadow-md
        `}
        style={{
          backgroundColor: addOpacity(settings.widget_secondary_color || settings.widget_accent_color, 0.25),
          borderColor: addOpacity(settings.widget_secondary_color || settings.widget_accent_color, 0.4),
          borderWidth: '1px',
          borderStyle: 'solid',
          color: settings.widget_text_color,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = addOpacity(settings.widget_secondary_color || settings.widget_accent_color, 0.3);
          e.currentTarget.style.borderColor = addOpacity(settings.widget_secondary_color || settings.widget_accent_color, 0.5);
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = addOpacity(settings.widget_secondary_color || settings.widget_accent_color, 0.25);
          e.currentTarget.style.borderColor = addOpacity(settings.widget_secondary_color || settings.widget_accent_color, 0.4);
        }}
      >
        {/* Icon/Indicator */}
        <div
          className='shrink-0 flex items-center justify-center w-4 h-4 rounded-full'
          style={{
            backgroundColor: addOpacity(settings.widget_accent_color, 0.2),
            color: settings.widget_accent_color,
          }}
        >
          <svg
            className='w-3 h-3'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2.5}
              d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        </div>

        {/* Message Text */}
        <div className='flex-1 break-words whitespace-pre-wrap' style={{ color: settings.widget_text_color }}>
          {message}
        </div>

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className='shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors duration-200'
            style={{
              color: settings.widget_text_color,
            }}
            aria-label='Close banner'
          >
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2.5}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

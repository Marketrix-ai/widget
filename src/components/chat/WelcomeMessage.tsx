import React from 'react';

import { formatMessageTime } from '../../utils/format';

interface WelcomeMessageProps {
  greeting: string;
  settings: {
    widget_shadow: string;
    widget_border_radius: string;
    widget_text_color: string;
    widget_border_color: string;
    widget_secondary_color: string;
  };
  marketrixIcon: string;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ greeting, settings, marketrixIcon }) => {
  return (
    <div key='welcome-message' className='group flex flex-col justify-start mt-2'>
      <style>{`
        .agent-logo-img {
          border: none !important;
          outline: none !important;
          box-shadow: ${settings.widget_shadow} !important;
          background-color: transparent !important;
          border-radius: ${settings.widget_border_radius} !important;
        }
        .agent-logo-img-container {
          background-color: transparent !important;
        }
      `}</style>
      <div className='flex items-start gap-1 flex-row'>
        {/* Agent Logo */}
        <div
          className='flex-shrink-0 agent-logo-img-container'
          style={{
            backgroundColor: 'transparent',
            width: '32px',
            height: '32px',
          }}
        >
          <img
            src={marketrixIcon}
            alt='Marketrix AI'
            className='agent-logo-img'
            style={{
              width: '32px',
              height: '32px',
              boxShadow: settings.widget_shadow,
              borderRadius: settings.widget_border_radius,
              border: 'none',
              outline: 'none',
              display: 'block',
              objectFit: 'cover',
              backgroundColor: 'transparent',
            }}
          />
        </div>

        {/* Message bubble */}
        <div
          className={`
            flex flex-col flex-1
            px-2.5 py-2 rounded-r-lg rounded-tl-lg rounded-bl-lg shadow-sm border
          `}
          style={{
            backgroundColor: '#ffffff',
            backgroundImage: 'none',
            color: settings.widget_text_color,
            borderColor: settings.widget_border_color,
          }}
        >
          {/* Message content */}
          <div className='text-xs font-inter font-medium leading-tight whitespace-pre-wrap break-words'>{greeting}</div>
        </div>
      </div>
      {/* Timestamp below card - agent message, so right-aligned */}
      <div className='flex justify-end mt-0.5'>
        <span className='text-[10px] font-inter font-normal' style={{ color: `${settings.widget_text_color}99` }}>
          {formatMessageTime(new Date())}
        </span>
      </div>
    </div>
  );
};

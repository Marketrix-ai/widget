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
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ greeting, settings }) => {
  return (
    <div key='welcome-message' className='group flex flex-col justify-start mt-2'>
      <div className='flex items-start flex-row'>
        {/* Message bubble */}
        <div
          className={`
            flex flex-col flex-1
            px-2.5 py-2 rounded-lg shadow-sm border
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
      {/* Timestamp below card */}
      <div className='flex justify-end mt-0.5'>
        <span className='text-[10px] font-inter font-normal' style={{ color: `${settings.widget_text_color}99` }}>
          {formatMessageTime(new Date())}
        </span>
      </div>
    </div>
  );
};

import React from 'react';

import SendIcon from '../../assets/send.png';
import { useWidget } from '../../hooks/useWidget';
import type { MarketrixConfig } from '../../types';
import { addOpacity, getContrastingColor } from '../../utils/format';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isLoading: boolean;
  isTaskRunning?: boolean;
  onStop?: () => void;
  config?: MarketrixConfig;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onKeyPress,
  onSend,
  isLoading,
  isTaskRunning = false,
  onStop,
  config,
}) => {
  // Get atmosphere configuration
  const { getWidgetText, settings } = useWidget(config ? { config } : {});
  const widgetText = getWidgetText();

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    } else {
      onKeyPress(e);
    }
  };

  const placeholderColor = addOpacity(settings.widget_text_color, 0.6);

  return (
    <div
      className={`
      py-2 pr-2
      bg-transparent
      `}
    >
      <style>{`
        textarea::placeholder {
          color: ${placeholderColor} !important;
        }
      `}</style>
      <div className='flex items-center space-x-2'>
        {/* Textarea */}
        <div className='flex-1 relative'>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={widgetText.placeholder}
            disabled={isLoading}
            rows={1}
            className={`
              w-full px-3 py-2 text-sm resize-none
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-sm
            `}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
              backgroundColor: settings.widget_background_color,
              borderColor: settings.widget_border_color,
              color: settings.widget_text_color,
            }}
          />
        </div>

        {/* Circular Send/Stop button */}
        {isTaskRunning && onStop ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStop();
            }}
            className={`
              w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center
              shadow-lg focus:outline-none
            `}
            style={{
              background: `linear-gradient(to right, #ef4444, #dc2626)`,
              color: '#ffffff',
            }}
            aria-label='Stop task'
          >
            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
              <rect x='6' y='6' width='8' height='8' rx='1' />
            </svg>
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSend();
            }}
            disabled={!value.trim() || isLoading}
            className={`
              w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center
              ${value.trim() && !isLoading ? 'shadow-lg' : 'cursor-not-allowed'}
              focus:outline-none
            `}
            style={
              value.trim() && !isLoading
                ? {
                    background: `linear-gradient(to right, ${settings.widget_secondary_color}, ${settings.widget_accent_color})`,
                    color: getContrastingColor(settings.widget_accent_color),
                  }
                : {
                    backgroundColor: addOpacity(settings.widget_border_color, 0.2),
                    color: addOpacity(settings.widget_text_color, 0.4),
                  }
            }
            aria-label='Send message'
          >
            <img src={SendIcon} alt='Send' className='w-4 h-4' />
          </button>
        )}
      </div>
    </div>
  );
};

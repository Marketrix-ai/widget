import React, { useEffect, useRef } from 'react';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea - shrink and grow with content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      // Set height to match content exactly
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [value]);

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
      <div className='flex items-start space-x-2'>
        {/* Textarea */}
        <div className='flex-1 relative'>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              // Auto-resize on change - shrink and grow with content
              const textarea = e.target;
              // Reset height to auto to get accurate scrollHeight
              textarea.style.height = 'auto';
              const scrollHeight = textarea.scrollHeight;
              // Set height to match content exactly
              textarea.style.height = `${scrollHeight}px`;
            }}
            onKeyPress={handleKeyPress}
            placeholder={widgetText.placeholder}
            disabled={isLoading}
            rows={1}
            className={`
              w-full px-3 text-sm resize-none
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              border rounded-none
            `}
            style={{
              backgroundColor: addOpacity('#ffffff', 0.7),
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderColor: settings.widget_border_color,
              color: settings.widget_text_color,
              lineHeight: '20px',
              paddingTop: '6px',
              paddingBottom: '6px',
              verticalAlign: 'middle',
              overflow: 'hidden',
              resize: 'none',
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
              w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0
              shadow-lg focus:outline-none
              mt-0.5
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
              w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0
              ${value.trim() && !isLoading ? 'shadow-lg' : 'cursor-not-allowed'}
              focus:outline-none
              mt-0.5
            `}
            style={
              value.trim() && !isLoading
                ? {
                    backgroundColor: settings.widget_accent_color,
                    color: getContrastingColor(settings.widget_accent_color),
                  }
                : {
                    backgroundColor: addOpacity(settings.widget_border_color, 0.2),
                    color: addOpacity(settings.widget_text_color, 0.4),
                  }
            }
            aria-label='Send message'
          >
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              viewBox='0 0 24 24'
            >
              <line x1='5' y1='12' x2='19' y2='12' />
              <polyline points='12 5 19 12 12 19' />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

import React from 'react';

import SendIcon from '../assets/send.png';
import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig } from '../types';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isLoading: boolean;
  config?: MarketrixConfig;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onKeyPress,
  onSend,
  isLoading,
  config,
}) => {
  // Get atmosphere configuration
  const { getWidgetText } = useWidget(config ? { config } : {});
  const widgetText = getWidgetText();

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    } else {
      onKeyPress(e);
    }
  };

  return (
    <div
      className={`
      py-2 pr-2
      bg-transparent
      `}
    >
      <div className='flex items-center space-x-2'>
        {/* Textarea */}
        <div className='flex-1 relative'>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={widgetText.placeholder || 'Show me..'}
            disabled={isLoading}
            rows={1}
            className={`
              w-full px-3 py-2 text-sm resize-none
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              bg-white border-gray-200 text-gray-900 placeholder-gray-400
              shadow-sm
            `}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
            }}
          />
        </div>

        {/* Circular Send button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSend();
          }}
          disabled={!value.trim() || isLoading}
          className={`
            w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center
            ${
              value.trim() && !isLoading
                ? 'bg-gradient-to-r from-[#B398F6] to-[#5CF2B5] text-white shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
            focus:outline-none focus:ring-2 focus:ring-green-500/20
          `}
          aria-label='Send message'
        >
          <img src={SendIcon} alt='Send' className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
};

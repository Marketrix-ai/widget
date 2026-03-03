import React, { useCallback, useEffect, useRef } from 'react';
import { IoSend, IoStop } from 'react-icons/io5';

import { useWidget } from '../../hooks/useWidget';
import type { MarketrixConfig } from '../../types';
import { addOpacity, getContrastingColor } from '../../utils/format';
import { Button } from '../base/Button';
import { Textarea } from '../base/Textarea';

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
  // Get configuration
  const { config: settings } = useWidget(config ? { config } : {});
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      } else {
        onKeyPress(e);
      }
    },
    [onSend, onKeyPress],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      const ta = e.target;
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    },
    [onChange],
  );

  const placeholderColor = addOpacity(settings.widget_text_color, 0.6);
  const canSend = Boolean(value.trim()) && !isLoading;

  return (
    <div className='py-2 pr-2 bg-transparent'>
      <style>{`.message-input-textarea::placeholder { color: ${placeholderColor}; }`}</style>
      <div className='flex items-start space-x-2'>
        <div className='flex-1 relative'>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
            placeholder='Ask anything'
            disabled={isLoading}
            rows={1}
            className='message-input-textarea w-full px-3 text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border rounded-none overflow-hidden'
            style={{
              backgroundColor: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderColor: settings.widget_border_color,
              color: settings.widget_text_color,
              lineHeight: '20px',
              paddingTop: '6px',
              paddingBottom: '6px',
            }}
          />
        </div>
        {isTaskRunning && onStop ? (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onStop();
            }}
            className='w-8 h-8 min-w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg mt-0.5'
            style={{
              background: 'linear-gradient(to right, #1f2937, #111827)',
              color: '#fff',
              border: 'none',
            }}
            aria-label='Stop task'
          >
            <IoStop className='w-4 h-4' />
          </Button>
        ) : (
          <Button
            type='button'
            variant='primary'
            size='sm'
            disabled={!canSend}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onSend();
            }}
            className='w-8 h-8 min-w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'
            style={
              canSend
                ? {
                    backgroundColor: settings.widget_accent_color,
                    color: getContrastingColor(settings.widget_accent_color),
                    border: 'none',
                  }
                : {
                    backgroundColor: addOpacity(settings.widget_border_color, 0.2),
                    color: addOpacity(settings.widget_text_color, 0.4),
                    border: 'none',
                  }
            }
            aria-label='Send message'
          >
            <IoSend className={canSend ? 'w-4 h-4' : 'w-4 h-4 ml-0.5'} />
          </Button>
        )}
      </div>
    </div>
  );
};

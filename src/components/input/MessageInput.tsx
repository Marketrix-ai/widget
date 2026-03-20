import React, { useCallback, useEffect, useRef } from 'react';
import { IoChatbubbleEllipsesOutline, IoStop } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import { useWidget } from '../../hooks/useWidget';
import type { InstructionType } from '../../sdk';
import type { MarketrixConfig } from '../../types';
import { addOpacity, getContrastingColor, getModeDisplayName } from '../../utils/format';
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
  currentMode?: InstructionType;
  enabledModes?: InstructionType[];
  onModeChange?: (mode: InstructionType) => void;
  isScreenSharing?: boolean;
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (el: T | null) => {
    refs.forEach(r => {
      if (typeof r === 'function') r(el);
      else if (r) (r as React.MutableRefObject<T | null>).current = el;
    });
  };
}

export const MessageInput = React.forwardRef<HTMLTextAreaElement, Omit<MessageInputProps, 'ref'>>(function MessageInput(
  {
    value,
    onChange,
    onKeyPress,
    onSend,
    isLoading,
    isTaskRunning = false,
    onStop,
    config,
    currentMode,
    enabledModes = [],
    onModeChange,
    isScreenSharing = false,
  },
  ref,
) {
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

  const orderedModes: InstructionType[] = (['tell', 'show', 'do'] as const).filter(m => enabledModes.includes(m));

  const getModeIcon = (mode: InstructionType) => {
    switch (mode) {
      case 'show':
        return <LuMousePointerClick className='w-3 h-3' />;
      case 'tell':
        return <IoChatbubbleEllipsesOutline className='w-3 h-3' />;
      case 'do':
        return <SiTicktick className='w-3 h-3' />;
      default:
        return null;
    }
  };

  return (
    <div className='py-1.5 px-2 bg-transparent'>
      <style>{`.message-input-textarea::placeholder { color: ${placeholderColor}; }`}</style>
      <div
        className='flex flex-col rounded-xl border overflow-hidden focus-within:border-gray-300 transition-colors'
        style={{
          borderColor: settings.widget_border_color,
          backgroundColor: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <Textarea
          ref={mergeRefs(textareaRef, ref)}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
          placeholder='Ask anything'
          disabled={isLoading}
          rows={1}
          className='message-input-textarea w-full px-3 text-sm resize-none focus:outline-none focus:ring-0 border-none shadow-none disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden'
          style={{
            backgroundColor: 'transparent',
            color: settings.widget_text_color,
            lineHeight: '20px',
            paddingTop: '8px',
            paddingBottom: '4px',
          }}
        />
        {/* Mode pills + send button row */}
        <div className='flex items-center justify-between px-1.5 pb-1.5'>
          <div className='flex items-center gap-1'>
            {orderedModes.map(mode => {
              const isActive = currentMode === mode;
              return (
                <button
                  key={mode}
                  type='button'
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onModeChange?.(mode);
                  }}
                  className={`flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 transition-all duration-200 ${isActive ? 'shadow-sm' : ''}`}
                  style={{
                    borderRadius: '20px',
                    ...(isActive
                      ? {
                          backgroundColor: settings.widget_accent_color,
                          color: getContrastingColor(settings.widget_accent_color),
                          border: 'none',
                        }
                      : {
                          backgroundColor: addOpacity(settings.widget_secondary_color, 0.15),
                          color: addOpacity(settings.widget_text_color, 0.7),
                          border: 'none',
                        }),
                    ...(isScreenSharing && isActive
                      ? {
                          animation: 'glow-border-pulse 2s ease-in-out infinite',
                        }
                      : {}),
                  }}
                >
                  {getModeIcon(mode)}
                  <span>{getModeDisplayName(mode)}</span>
                </button>
              );
            })}
          </div>
          <Button
            type='button'
            variant={isTaskRunning ? 'secondary' : 'primary'}
            size='sm'
            disabled={!isTaskRunning && !canSend}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (isTaskRunning && onStop) {
                onStop();
              } else {
                onSend();
              }
            }}
            className='w-7 h-7 min-w-7 rounded-full flex items-center justify-center flex-shrink-0'
            style={
              isTaskRunning
                ? {
                    background: 'linear-gradient(to right, #1f2937, #111827)',
                    color: '#fff',
                    border: 'none',
                  }
                : canSend
                  ? {
                      backgroundColor: settings.widget_accent_color,
                      color: getContrastingColor(settings.widget_accent_color),
                      border: 'none',
                    }
                  : {
                      backgroundColor: 'transparent',
                      color: addOpacity(settings.widget_text_color, 0.4),
                      border: 'none',
                    }
            }
            aria-label={isTaskRunning ? 'Stop task' : 'Send message'}
          >
            {isTaskRunning ? (
              <IoStop className='w-3.5 h-3.5' />
            ) : (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 12h14m-7-7l7 7-7 7' />
              </svg>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

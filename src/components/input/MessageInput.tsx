import React, { useCallback, useEffect, useRef } from 'react';
import { IoChatbubbleEllipsesOutline, IoStop } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import type { InstructionType } from '../../sdk';
import { getModeDisplayName } from '../../utils/format';
import { IconButton } from '../base/IconButton';
import { Pill } from '../base/Pill';
import { Textarea } from '../base/Textarea';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isLoading: boolean;
  isTaskRunning?: boolean;
  onStop?: () => void;
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
    currentMode,
    enabledModes = [],
    onModeChange,
    isScreenSharing = false,
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea - grow up to 2 lines, then scroll
  const maxTextareaHeight = 46; // 2 lines (20px each) + 6px padding
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const clamped = Math.min(scrollHeight, maxTextareaHeight);
      textarea.style.height = `${clamped}px`;
      textarea.style.overflowY = scrollHeight > maxTextareaHeight ? 'auto' : 'hidden';
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
      const clamped = Math.min(ta.scrollHeight, maxTextareaHeight);
      ta.style.height = `${clamped}px`;
      ta.style.overflowY = ta.scrollHeight > maxTextareaHeight ? 'auto' : 'hidden';
    },
    [onChange],
  );

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
      <div className='flex flex-col rounded-xl border border-border overflow-hidden focus-within:border-foreground-faint transition-colors bg-card/70 backdrop-blur-sm'>
        <Textarea
          ref={mergeRefs(textareaRef, ref)}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
          placeholder='Ask anything'
          disabled={isLoading}
          rows={1}
          className='message-input-textarea w-full px-3 text-sm text-foreground placeholder:text-foreground-faint resize-none focus:outline-none focus:ring-0 border-none shadow-none disabled:opacity-50 disabled:cursor-not-allowed'
          style={{
            backgroundColor: 'transparent',
            lineHeight: '20px',
            paddingTop: '4px',
            paddingBottom: '2px',
          }}
        />
        {/* Mode pills + send button row */}
        <div className='flex items-center justify-between px-1.5 pb-1.5'>
          <div className='flex items-center gap-1'>
            {orderedModes.map(mode => {
              const isActive = currentMode === mode;
              return (
                <Pill
                  key={mode}
                  active={isActive}
                  size='sm'
                  animated={isScreenSharing && isActive}
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onModeChange?.(mode);
                  }}
                >
                  {getModeIcon(mode)}
                  <span>{getModeDisplayName(mode)}</span>
                </Pill>
              );
            })}
          </div>
          <IconButton
            variant={isTaskRunning ? 'secondary' : canSend ? 'primary' : 'ghost'}
            size='sm'
            disabled={!isTaskRunning && !canSend}
            label={isTaskRunning ? 'Stop task' : 'Send message'}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (isTaskRunning && onStop) {
                onStop();
              } else {
                onSend();
              }
            }}
          >
            {isTaskRunning ? (
              <IoStop className='w-3.5 h-3.5' />
            ) : (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 12h14m-7-7l7 7-7 7' />
              </svg>
            )}
          </IconButton>
        </div>
      </div>
    </div>
  );
});

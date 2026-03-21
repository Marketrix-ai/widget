import React, { useCallback, useEffect, useRef } from 'react';

import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import type { IconName } from '../base/icons';
import { Pill } from '../base/Pill';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';
import { Textarea } from '../base/Textarea';

export interface ChatInputMode {
  id: string;
  icon: IconName;
  label: string;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  modes?: ChatInputMode[];
  activeMode?: string;
  onModeChange?: (mode: string) => void;
  disabled?: boolean;
  taskRunning?: boolean;
  onStop?: () => void;
  placeholder?: string;
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (el: T | null) => {
    refs.forEach(r => {
      if (typeof r === 'function') r(el);
      else if (r) (r as React.MutableRefObject<T | null>).current = el;
    });
  };
}

export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(function ChatInput(
  {
    value,
    onChange,
    onSubmit,
    modes = [],
    activeMode,
    onModeChange,
    disabled = false,
    taskRunning = false,
    onStop,
    placeholder = 'Ask anything',
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxTextareaHeight = 66; // 3 lines (20px each) + 6px padding

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  const canSend = Boolean(value.trim()) && !disabled;

  return (
    <Stack className='rounded-xl border border-border overflow-hidden focus-within:border-foreground-faint transition-colors'>
      <Textarea
        ref={mergeRefs(textareaRef, ref)}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className='w-full px-3 text-sm text-foreground placeholder:text-foreground-faint resize-none focus:outline-none focus:ring-0 border-none shadow-none disabled:opacity-50 disabled:cursor-not-allowed'
        style={{
          backgroundColor: 'transparent',
          lineHeight: '20px',
          paddingTop: '4px',
          paddingBottom: '2px',
          minHeight: 'unset',
        }}
      />
      <Flex className='items-center justify-between px-1.5 pt-1 pb-1.5'>
        <Flex className='items-center gap-1'>
          {modes.map(mode => {
            const isActive = activeMode === mode.id;
            return (
              <Pill
                key={mode.id}
                active={isActive}
                size='sm'
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onModeChange?.(mode.id);
                }}
              >
                <Icon name={mode.icon} size={12} />
                <Text as='span' className='text-inherit'>
                  {mode.label}
                </Text>
              </Pill>
            );
          })}
        </Flex>
        <IconButton
          variant={taskRunning ? 'secondary' : 'primary'}
          size='sm'
          disabled={!taskRunning && !canSend}
          label={taskRunning ? 'Stop task' : 'Send message'}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            if (taskRunning && onStop) {
              onStop();
            } else {
              onSubmit();
            }
          }}
        >
          {taskRunning ? <Icon name='stop' size={14} /> : <Icon name='send' size={16} />}
        </IconButton>
      </Flex>
    </Stack>
  );
});

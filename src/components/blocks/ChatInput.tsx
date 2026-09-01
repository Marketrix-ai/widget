import React, { useCallback, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

import { radiusClasses } from '../../design-system/component-tokens';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import type { IconName } from '../base/icons';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

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
  ref?: React.Ref<HTMLTextAreaElement>;
}

const MAX_TEXTAREA_HEIGHT = 66; // 3 lines (20px each) + 6px padding

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (el: T | null) => {
    refs.forEach(r => {
      if (typeof r === 'function') r(el);
      else if (r) (r as React.MutableRefObject<T | null>).current = el;
    });
  };
}

export function ChatInput({
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
  ref,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const { scrollHeight } = textarea;
    textarea.style.height = `${Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    textarea.style.overflowY = scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

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
    <Stack
      background='card'
      rounded='xl'
      border
      overflow='hidden'
      className='focus-within:border-foreground-faint transition-colors'
    >
      <textarea
        ref={mergeRefs(textareaRef, ref)}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className='block w-full min-h-0 resize-none rounded-none border-none bg-transparent px-3 text-sm text-foreground transition-colors placeholder:text-foreground-faint focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
        style={{
          lineHeight: '20px',
          paddingTop: '4px',
          paddingBottom: '2px',
          minHeight: 'unset',
        }}
      />
      <Flex align='center' justify='between' paddingX='sm' paddingTop='2xs' paddingBottom='sm'>
        <Flex align='center' gap='2xs'>
          {modes.map(mode => {
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type='button'
                className={cn(
                  'inline-flex cursor-pointer items-center gap-0.5 border-none px-2 py-0.5 text-[11px] font-medium transition-all duration-200',
                  radiusClasses.pill,
                  isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary-bg text-foreground-muted',
                )}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onModeChange?.(mode.id);
                }}
              >
                <Icon name={mode.icon} size={12} />
                <Text as='span' inheritColor>
                  {mode.label}
                </Text>
              </button>
            );
          })}
        </Flex>
        <IconButton
          variant={taskRunning ? 'secondary' : 'primary'}
          size='sm'
          disabled={!taskRunning && !canSend}
          label={taskRunning ? 'Stop simulation' : 'Send message'}
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
}

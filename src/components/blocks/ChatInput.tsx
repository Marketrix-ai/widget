/**
 * The widget's chat input: an auto-growing textarea with send and stop.
 *
 * `MAX_TEXTAREA_HEIGHT` caps growth at three lines — 20px each plus 6px of padding — after which it
 * scrolls, so a long message cannot push the conversation off a small host page.
 *
 * `mergeRefs` combines the caller's ref with the internal one, since the component needs its own
 * handle to measure and resize.
 */

import React, { useCallback, useEffect, useRef } from 'react';

import type { InstructionType } from '../../types';
import { Flex, Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import type { IconName } from '../base/icons';
import { Text } from '../base/Text';

export interface ChatInputMode {
  id: InstructionType;
  icon: IconName;
  label: string;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  modes?: ChatInputMode[];
  activeMode?: InstructionType;
  onModeChange?: (mode: InstructionType) => void;
  disabled?: boolean;
  taskRunning?: boolean;
  onStop?: () => void;
  ref?: React.Ref<HTMLTextAreaElement>;
}

const MAX_TEXTAREA_HEIGHT = 66;

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
    <Stack background='card' rounded='xl' border overflow='hidden' className='mtx-composer'>
      <textarea
        ref={mergeRefs(textareaRef, ref)}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder='Ask anything'
        disabled={disabled}
        rows={1}
        className='mtx-composer-input'
        style={{
          lineHeight: '20px',
          paddingTop: '4px',
          paddingBottom: '2px',
          minHeight: 'unset',
        }}
      />
      <Flex align='center' justify='between' paddingX='sm' paddingTop='xs' paddingBottom='sm'>
        <Flex align='center' gap='xs'>
          {modes.map(mode => {
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type='button'
                className='mtx-mode-chip'
                data-active={isActive ? 'true' : 'false'}
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
          label={taskRunning ? 'Stop the assistant' : 'Send message'}
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

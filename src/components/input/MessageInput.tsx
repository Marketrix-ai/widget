import React, { useCallback, useEffect, useRef } from 'react';

import type { InstructionType } from '../../sdk';
import { getModeDisplayName } from '../../utils/format';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Pill } from '../base/Pill';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
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
        return <Icon name='mousePointerClick' size={12} />;
      case 'tell':
        return <Icon name='chatBubble' size={12} />;
      case 'do':
        return <Icon name='ticktick' size={12} />;
      default:
        return null;
    }
  };

  return (
    <Surface className='py-1.5 px-2 bg-transparent'>
      <Stack className='rounded-xl border border-border overflow-hidden focus-within:border-foreground-faint transition-colors bg-card/70 backdrop-blur-sm'>
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
        <Flex className='items-center justify-between px-1.5 pb-1.5'>
          <Flex className='items-center gap-1'>
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
                  <Text as='span' className='text-inherit'>
                    {getModeDisplayName(mode)}
                  </Text>
                </Pill>
              );
            })}
          </Flex>
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
            {isTaskRunning ? <Icon name='stop' size={14} /> : <Icon name='send' size={16} />}
          </IconButton>
        </Flex>
      </Stack>
    </Surface>
  );
});

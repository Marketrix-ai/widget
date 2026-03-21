import React from 'react';

import type { ChatMessage, WidgetState } from '../../types';
import { formatMessageTime } from '../../utils/format';
import { Avatar, Button, Flex, Stack, Text } from '../base';
import { MessageContent } from './MessageContent';
import { TaskStatusIcon } from './TaskStatusIcon';
import { VideoStreamDisplay } from './VideoStreamDisplay';

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  isLastMessage: boolean;
  widgetState: WidgetState;
  settings: {
    widget_accent_color: string;
    widget_text_color: string;
    widget_border_color: string;
    widget_shadow: string;
    widget_border_radius: string;
  };
  marketrixIcon: string;
  onScreenAccessAllow?: () => void;
  onScreenAccessDeny?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  index,
  isLastMessage,
  widgetState,
  settings,
  marketrixIcon,
  onScreenAccessAllow,
  onScreenAccessDeny,
}) => {
  // Render system messages differently (muted, centered)
  if (message.isSystemMessage) {
    return (
      <Flex key={`message-${message.id}-${index}`} className='justify-center items-center py-0'>
        <Text as='span' variant='faint' className='text-[10px] font-inter font-normal'>
          {message.content}
        </Text>
      </Flex>
    );
  }

  const isUser = message.sender === 'user';

  return (
    <Stack
      key={`message-${message.id}-${index}`}
      className={`group mt-[10px] ${isLastMessage ? 'animate-message-enter' : ''}`}
      role='article'
      aria-roledescription='message'
      aria-label={isUser ? 'You said…' : 'Agent says…'}
    >
      <Flex className='items-start gap-1 w-full flex-row'>
        {/* Logo or Spacer - Always on left */}
        <Flex className='flex-shrink-0 agent-logo-img-container w-8 h-8 bg-transparent'>
          {!isUser && (
            <Avatar
              src={marketrixIcon}
              alt='Marketrix AI'
              size='md'
              className='agent-logo-img shadow-[var(--shadow)] rounded-[var(--radius)] block object-cover bg-transparent'
              style={{ border: 'none', outline: 'none' }}
            />
          )}
        </Flex>

        {/* Message bubble */}
        <Stack
          className={`flex-1 relative
          ${message.videoStream ? 'p-0' : 'px-2.5 py-2'}
          ${!isUser ? 'rounded-[var(--radius)] shadow-[0_1px_4px_rgba(0,0,0,0.1)]' : 'border'}
          ${isUser ? 'rounded-l-[var(--radius)] rounded-tr-[var(--radius)] rounded-br-[var(--radius)] bg-primary text-primary-foreground border-primary' : 'text-foreground border-transparent'}
        `}
          style={{
            maxWidth: isUser ? 'calc(100% - 40px)' : '280px',
          }}
        >
          {/* Video stream display - edge-to-edge */}
          {message.videoStream && <VideoStreamDisplay stream={message.videoStream} isUserMessage={isUser} />}
          {/* Message content */}
          {!message.videoStream && (
            <MessageContent
              message={message}
              isLastMessage={isLastMessage}
              widgetState={widgetState}
              accentColor={settings.widget_accent_color}
              textColor={isUser ? 'inherit' : 'inherit'}
            />
          )}

          {/* Screen access request action buttons - show if not yet handled */}
          {message.isScreenAccessRequest && !message.screenShareStatus && (
            <Flex className='mt-1.5 pt-0.5 gap-2'>
              <Button
                type='button'
                variant='primary'
                size='sm'
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onScreenAccessAllow?.();
                }}
                className='flex items-center justify-center text-sm font-medium h-[26px] min-w-[65px] rounded-[22px]'
                style={{
                  backgroundColor: '#111827',
                  color: '#fff',
                  border: 'none',
                }}
              >
                Yes
              </Button>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onScreenAccessDeny?.();
                }}
                className='flex items-center justify-center text-sm font-medium h-[26px] min-w-[65px] rounded-[22px] border border-gray-200'
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#111827',
                }}
              >
                No
              </Button>
            </Flex>
          )}

          {/* Screen access request handled state - show decision */}
          {message.isScreenAccessRequest && message.screenShareStatus === 'allowed' && (
            <Text as='div' variant='faint' className='mt-0.5 text-xs font-medium italic'>
              Sure
            </Text>
          )}
          {message.isScreenAccessRequest && message.screenShareStatus === 'denied' && (
            <Text as='div' variant='faint' className='mt-0.5 text-xs font-medium italic'>
              Check HTML Instead
            </Text>
          )}

          {/* Task status icon at bottom right (only for agent messages with task status) */}
          {!isUser && message.taskStatus && (
            <Flex className='absolute bottom-1 right-1 items-center justify-center'>
              <TaskStatusIcon status={message.taskStatus} accentColor={settings.widget_accent_color} />
            </Flex>
          )}
        </Stack>
      </Flex>
      {/* Attribution line for agent messages */}
      {!isUser && !message.isPlaceholder && (
        <Text as='div' variant='muted' className='text-[11px] mt-1 ml-9'>
          Marketrix • AI Agent • {formatMessageTime(message.timestamp)}
        </Text>
      )}
      {/* Timestamp below card */}
      {!message.isPlaceholder && isUser && (
        <Flex className='justify-end mt-0.5 mr-1'>
          <Text as='span' variant='faint' className='text-[10px] font-inter font-normal'>
            {formatMessageTime(message.timestamp)}
          </Text>
        </Flex>
      )}
    </Stack>
  );
};

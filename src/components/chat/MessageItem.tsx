import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { SHADOW } from '../../design-system/shadows';
import type { ChatMessage } from '../../types';
import { formatMessageTime } from '../../utils/format';
import { Avatar, Button, Flex, Stack, Text } from '../base';
import { MessageContent } from './MessageContent';
import { TaskStatusIcon } from './TaskStatusIcon';
import { VideoStreamDisplay } from './VideoStreamDisplay';

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  isLastMessage: boolean;
  onScreenAccessAllow?: () => void;
  onScreenAccessDeny?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  index,
  isLastMessage,
  onScreenAccessAllow,
  onScreenAccessDeny,
}) => {
  // Render system messages differently (muted, centered)
  if (message.isSystemMessage) {
    return (
      <Flex key={`message-${message.id}-${index}`} justify='center' align='center'>
        <Text as='span' variant='faint' weight='normal' style={{ fontSize: '10px' }}>
          {message.content}
        </Text>
      </Flex>
    );
  }

  const isUser = message.sender === 'user';

  return (
    <Stack
      key={`message-${message.id}-${index}`}
      style={{ marginTop: '10px' }}
      role='article'
      aria-roledescription='message'
      aria-label={isUser ? 'You said…' : 'Agent says…'}
      animate={isLastMessage ? 'fadeIn' : undefined}
    >
      <Flex align='start' gap='sm' width='full'>
        {/* Logo (agent) or spacer (user) on left */}
        <Flex shrink={false} style={{ width: '20px', height: '20px', marginTop: '6px' }}>
          {!isUser && (
            <Avatar
              src={MarketrixIcon}
              alt='Marketrix AI'
              size={20}
              style={{
                border: 'none',
                outline: 'none',
                display: 'block',
                objectFit: 'cover',
                backgroundColor: 'transparent',
                borderRadius: 'calc(var(--radius) * 0.6)',
              }}
            />
          )}
        </Flex>

        {/* Message bubble */}
        <Stack
          grow
          position='relative'
          style={{
            padding: message.videoStream ? '0' : '8px 10px',
            borderRadius: 'var(--radius)',
            boxShadow: SHADOW.card,
            border: '1px solid transparent',
            backgroundColor: isUser ? 'var(--primary)' : undefined,
            color: isUser ? 'var(--primary-foreground)' : 'var(--foreground)',
          }}
        >
          {/* Video stream display - edge-to-edge */}
          {message.videoStream && <VideoStreamDisplay stream={message.videoStream} />}
          {/* Message content */}
          {!message.videoStream && <MessageContent message={message} isLastMessage={isLastMessage} />}

          {/* Screen access request action buttons - show if not yet handled */}
          {message.isScreenAccessRequest && !message.screenShareStatus && (
            <Flex align='center' gap='sm' style={{ marginTop: '6px' }}>
              <Button
                type='button'
                variant='primary'
                size='sm'
                className='rounded-full'
                onClick={() => onScreenAccessAllow?.()}
              >
                Yes
              </Button>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                className='rounded-full'
                onClick={() => onScreenAccessDeny?.()}
              >
                No
              </Button>
            </Flex>
          )}

          {message.isScreenAccessRequest && message.screenShareStatus && (
            <Text as='div' variant='faint' size='xs' style={{ marginTop: '2px', fontStyle: 'italic' }}>
              {message.screenShareStatus === 'allowed' ? 'Sure' : 'Check HTML Instead'}
            </Text>
          )}

          {/* Task status icon at bottom right (only for agent messages with task status) */}
          {!isUser && message.taskStatus && (
            <Flex position='absolute' align='center' justify='center' style={{ bottom: '4px', right: '4px' }}>
              <TaskStatusIcon status={message.taskStatus} />
            </Flex>
          )}
        </Stack>

        {/* Spacer on right for user messages */}
        <Flex shrink={false} style={{ width: '20px' }} />
      </Flex>
      {/* Timestamp — right-aligned */}
      {!message.isPlaceholder && (
        <Text
          as='div'
          variant='faint'
          style={{ marginTop: '2px', textAlign: 'right', marginRight: '26px', fontSize: '10px' }}
        >
          {formatMessageTime(message.timestamp)}
        </Text>
      )}
    </Stack>
  );
};

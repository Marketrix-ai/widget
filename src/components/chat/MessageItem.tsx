import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
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
              fit='cover'
              rounded='theme'
              style={{
                border: 'none',
                outline: 'none',
                display: 'block',
                backgroundColor: 'transparent',
              }}
            />
          )}
        </Flex>

        {/* Message bubble */}
        <Stack
          grow
          position='relative'
          rounded='theme'
          elevation='card'
          style={{
            padding: message.videoStream ? '0' : '8px 10px',
            border: isUser ? '1px solid transparent' : '1px solid var(--border)',
            backgroundColor: isUser ? 'var(--primary)' : 'var(--card)',
            color: isUser ? 'var(--primary-foreground)' : 'var(--foreground)',
          }}
        >
          {/* Video stream display - edge-to-edge */}
          {message.videoStream && <VideoStreamDisplay stream={message.videoStream} />}

          {/* Typing indicator for thinking placeholder */}
          {!message.videoStream && message.isPlaceholder && message.placeholderState === 'thinking' && (
            <Flex align='center' gap='sm' style={{ padding: '4px 2px' }} role='status' aria-label='Agent is typing'>
              <span className='typing-dot' aria-hidden='true' />
              <span className='typing-dot' aria-hidden='true' />
              <span className='typing-dot' aria-hidden='true' />
            </Flex>
          )}

          {/* Message content */}
          {!message.videoStream && !(message.isPlaceholder && message.placeholderState === 'thinking') && (
            <MessageContent message={message} isLastMessage={isLastMessage} />
          )}

          {/* Screen access request action buttons - show if not yet handled */}
          {message.isScreenAccessRequest && !message.screenShareStatus && (
            <Flex align='center' gap='sm' style={{ marginTop: '6px' }}>
              <Button type='button' variant='primary' size='sm' shape='pill' onClick={() => onScreenAccessAllow?.()}>
                Yes
              </Button>
              <Button type='button' variant='secondary' size='sm' shape='pill' onClick={() => onScreenAccessDeny?.()}>
                No
              </Button>
            </Flex>
          )}

          {message.isScreenAccessRequest && message.screenShareStatus && (
            <Text as='div' variant='faint' size='xs' italic style={{ marginTop: '2px' }}>
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
        <Text as='div' variant='faint' size='xxs' align='right' style={{ marginTop: '2px', marginRight: '26px' }}>
          {formatMessageTime(message.timestamp)}
        </Text>
      )}
    </Stack>
  );
};

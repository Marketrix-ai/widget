import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import type { ChatMessage } from '../../types';
import { formatMessageTime } from '../../utils/format';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';
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

        <Stack
          grow
          position='relative'
          rounded='theme'
          elevation='card'
          style={{
            padding: message.videoStream ? '0' : '8px 10px',
            border: '1px solid transparent',
            backgroundColor: isUser ? 'var(--primary)' : undefined,
            color: isUser ? 'var(--primary-foreground)' : 'var(--foreground)',
          }}
        >
          {message.videoStream && <VideoStreamDisplay stream={message.videoStream} />}
          {!message.videoStream && <MessageContent message={message} isLastMessage={isLastMessage} />}

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

          {!isUser && message.taskStatus && (
            <Flex position='absolute' align='center' justify='center' style={{ bottom: '4px', right: '4px' }}>
              <TaskStatusIcon status={message.taskStatus} />
            </Flex>
          )}
        </Stack>

        <Flex shrink={false} style={{ width: '20px' }} />
      </Flex>
      {!message.isPlaceholder && (
        <Text as='div' variant='faint' size='xxs' align='right' style={{ marginTop: '2px', marginRight: '26px' }}>
          {formatMessageTime(message.timestamp)}
        </Text>
      )}
    </Stack>
  );
};

import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
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
  };
  onScreenAccessAllow?: () => void;
  onScreenAccessDeny?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  index,
  isLastMessage,
  widgetState,
  settings,
  onScreenAccessAllow,
  onScreenAccessDeny,
}) => {
  // Render system messages differently (muted, centered)
  if (message.isSystemMessage) {
    return (
      <Flex key={`message-${message.id}-${index}`} justify='center' align='center'>
        <Text as='span' variant='faint' style={{ fontSize: '10px', fontWeight: 'normal' }}>
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
      <Flex align='start' gap='xs' width='full'>
        {/* Logo or Spacer - Always on left */}
        <Flex shrink={false} style={{ width: '24px', height: '24px', backgroundColor: 'transparent' }}>
          {!isUser && (
            <Avatar
              src={MarketrixIcon}
              alt='Marketrix AI'
              size={24}
              rounded='theme'
              style={{
                border: 'none',
                outline: 'none',
                display: 'block',
                objectFit: 'cover',
                backgroundColor: 'transparent',
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
            borderRadius: isUser ? 'var(--radius) 0 var(--radius) var(--radius)' : 'var(--radius)',
            boxShadow: !isUser ? '0 1px 4px rgba(0,0,0,0.1)' : undefined,
            border: isUser ? '1px solid var(--primary)' : '1px solid transparent',
            backgroundColor: isUser ? 'var(--primary)' : undefined,
            color: isUser ? 'var(--primary-foreground)' : 'var(--foreground)',
            maxWidth: isUser ? 'calc(100% - 40px)' : '280px',
          }}
        >
          {/* Video stream display - edge-to-edge */}
          {message.videoStream && <VideoStreamDisplay stream={message.videoStream} />}
          {/* Message content */}
          {!message.videoStream && (
            <MessageContent
              message={message}
              isLastMessage={isLastMessage}
              widgetState={widgetState}
              accentColor={settings.widget_accent_color}
            />
          )}

          {/* Screen access request action buttons - show if not yet handled */}
          {message.isScreenAccessRequest && !message.screenShareStatus && (
            <Flex align='center' gap='md' style={{ marginTop: '6px', paddingTop: '2px' }}>
              <Button
                type='button'
                variant='primary'
                size='sm'
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onScreenAccessAllow?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 500,
                  height: '26px',
                  minWidth: '65px',
                  borderRadius: '22px',
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 500,
                  height: '26px',
                  minWidth: '65px',
                  borderRadius: '22px',
                  backgroundColor: '#f3f4f6',
                  color: '#111827',
                  border: '1px solid #e5e7eb',
                }}
              >
                No
              </Button>
            </Flex>
          )}

          {/* Screen access request handled state - show decision */}
          {message.isScreenAccessRequest && message.screenShareStatus === 'allowed' && (
            <Text as='div' variant='faint' size='xs' weight='medium' style={{ marginTop: '2px', fontStyle: 'italic' }}>
              Sure
            </Text>
          )}
          {message.isScreenAccessRequest && message.screenShareStatus === 'denied' && (
            <Text as='div' variant='faint' size='xs' weight='medium' style={{ marginTop: '2px', fontStyle: 'italic' }}>
              Check HTML Instead
            </Text>
          )}

          {/* Task status icon at bottom right (only for agent messages with task status) */}
          {!isUser && message.taskStatus && (
            <Flex position='absolute' align='center' justify='center' style={{ bottom: '4px', right: '4px' }}>
              <TaskStatusIcon status={message.taskStatus} accentColor={settings.widget_accent_color} />
            </Flex>
          )}
        </Stack>
      </Flex>
      {/* Attribution line for agent messages */}
      {!isUser && !message.isPlaceholder && (
        <Text as='div' variant='muted' style={{ fontSize: '11px', marginTop: '4px', marginLeft: '28px' }}>
          Marketrix • AI Agent • {formatMessageTime(message.timestamp)}
        </Text>
      )}
      {/* Timestamp below card */}
      {!message.isPlaceholder && isUser && (
        <Flex justify='end' style={{ marginTop: '2px', marginRight: '4px' }}>
          <Text as='span' variant='faint' weight='normal' style={{ fontSize: '10px' }}>
            {formatMessageTime(message.timestamp)}
          </Text>
        </Flex>
      )}
    </Stack>
  );
};

/**
 * One transcript row: a faint centred system message, or a user/agent row with glyph, label, body,
 * screen-access controls and a status glyph; `MessageBody` renders its parts and `Thinking` the pending row.
 * `MessageItem` takes `isTaskRunning` as a prop rather than from context, since a row subscribed to context
 * re-renders on every streamed token.
 */
import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { useWidgetConfig } from '../../hooks/useWidget';
import type { AgentStatus, ChatMessage } from '../../types';
import { formatMessageTime, isPending, messageText } from '../../utils/chat';
import { addOpacity } from '../../utils/color';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex, Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import type { IconName } from '../base/icons';
import { Spinner } from '../base/Spinner';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { VideoStreamDisplay } from './VideoStreamDisplay';

interface MessageItemProps {
  message: ChatMessage;
  isLastMessage: boolean;
  isTaskRunning: boolean;
  onScreenAccessAllow: () => Promise<void>;
  onScreenAccessDeny: () => void;
}

const STATUS_ICONS: Partial<Record<AgentStatus, { name: IconName; opacity: number }>> = {
  done: { name: 'checkCircle', opacity: 1 },
  failed: { name: 'exclamationCircle', opacity: 0.75 },
  stopped: { name: 'circle', opacity: 0.5 },
};

const waitsForVisitor = (message: ChatMessage): boolean =>
  message.kind === 'agent' && (message.status === 'waiting-for-user' || message.status === 'question');

const Thinking: React.FC<{ isWaitingForUser: boolean }> = ({ isWaitingForUser }) => (
  <Flex align='center' gap='sm' paddingY='2xs'>
    <Spinner size='sm' />
    <Text as='span' size='xs' weight='normal' variant='faint'>
      {isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking'}
    </Text>
  </Flex>
);

const MessageBody: React.FC<{ message: ChatMessage; isLastMessage: boolean; isTaskRunning: boolean }> = ({
  message,
  isLastMessage,
  isTaskRunning,
}) => {
  const pending = isPending(message);
  const isWaitingForUser = waitsForVisitor(message);
  const stillWorking =
    isTaskRunning && isLastMessage && 'mode' in message && (message.mode === 'show' || message.mode === 'do');

  if (message.parts.length === 0) {
    return pending || stillWorking ? <Thinking isWaitingForUser={isWaitingForUser} /> : <Surface />;
  }

  return (
    <Stack gap='sm'>
      {message.parts.map((part, index) => {
        if (part.type === 'text') {
          if (!part.content) return null;
          return (
            <Text
              as='div'
              key={`part-${index}`}
              size='sm'
              weight='medium'
              style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', marginBottom: '4px' }}
            >
              {part.content}
            </Text>
          );
        }
        return (
          <Flex key={`part-${index}`} align='start' gap='md'>
            <Text as='span' size='xs' weight='medium' style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
              {part.content}
            </Text>
          </Flex>
        );
      })}

      {((pending && !message.parts.some(p => p.type === 'text')) || stillWorking) && (
        <Thinking isWaitingForUser={isWaitingForUser} />
      )}
    </Stack>
  );
};

const MessageItemComponent: React.FC<MessageItemProps> = ({
  message,
  isLastMessage,
  isTaskRunning,
  onScreenAccessAllow,
  onScreenAccessDeny,
}) => {
  const accentColor = useWidgetConfig().widget_accent_color;

  if (message.kind === 'system') {
    return (
      <Flex justify='center' align='center'>
        <Text as='span' variant='faint' weight='normal' style={{ fontSize: '10px' }}>
          {messageText(message.parts)}
        </Text>
      </Flex>
    );
  }

  const isUser = message.kind === 'user' || message.kind === 'screenshare';
  const leadingIcon =
    message.kind === 'user' && (message.mode === 'show' || message.mode === 'do')
      ? ('mousePointerClick' as const)
      : message.kind === 'screenAccess' || waitsForVisitor(message)
        ? ('checkCircle' as const)
        : undefined;
  const status = message.kind === 'agent' && message.status ? STATUS_ICONS[message.status] : undefined;

  return (
    <Stack
      style={{ marginTop: '10px' }}
      role='article'
      aria-roledescription='message'
      aria-label={isUser ? 'You said…' : 'Assistant says…'}
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
              rounded='lg'
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
          rounded='lg'
          elevation='card'
          style={{
            padding: message.kind === 'screenshare' ? '0' : '8px 10px',
            border: '1px solid transparent',
            backgroundColor: isUser ? 'var(--primary)' : undefined,
            color: isUser ? 'var(--primary-foreground)' : 'var(--foreground)',
          }}
        >
          {message.kind === 'screenshare' ? (
            <VideoStreamDisplay stream={message.videoStream} />
          ) : leadingIcon ? (
            <Flex align='start' gap='sm'>
              <Flex shrink={false} style={{ marginTop: '3px' }}>
                <Icon name={leadingIcon} size={13} />
              </Flex>
              <Stack grow>
                <MessageBody message={message} isLastMessage={isLastMessage} isTaskRunning={isTaskRunning} />
              </Stack>
            </Flex>
          ) : (
            <MessageBody message={message} isLastMessage={isLastMessage} isTaskRunning={isTaskRunning} />
          )}

          {message.kind === 'screenAccess' && !message.screenShareStatus && (
            <Flex align='center' gap='sm' style={{ marginTop: '6px' }}>
              <Button variant='primary' size='sm' shape='pill' onClick={() => void onScreenAccessAllow()}>
                Yes
              </Button>
              <Button variant='secondary' size='sm' shape='pill' onClick={onScreenAccessDeny}>
                No
              </Button>
            </Flex>
          )}

          {message.kind === 'screenAccess' && message.screenShareStatus && (
            <Text as='div' variant='faint' size='xs' italic style={{ marginTop: '2px' }}>
              {message.screenShareStatus === 'allowed' ? 'Sure' : 'No'}
            </Text>
          )}

          {status && (
            <Flex position='absolute' align='center' justify='center' style={{ bottom: '4px', right: '4px' }}>
              <Icon
                name={status.name}
                size={14}
                style={{ color: addOpacity(accentColor, status.opacity), flexShrink: 0 }}
              />
            </Flex>
          )}
        </Stack>

        <Flex shrink={false} style={{ width: '20px' }} />
      </Flex>
      {!isPending(message) && (
        <Text as='div' variant='faint' size='xxs' align='right' style={{ marginTop: '2px', marginRight: '26px' }}>
          {formatMessageTime(message.timestamp)}
        </Text>
      )}
    </Stack>
  );
};

export const MessageItem = React.memo(MessageItemComponent);

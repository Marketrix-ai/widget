/**
 * One transcript row and everything drawn inside it. `MessageItem` renders a system message centred and
 * faint, or a user/agent row with a leading glyph (a pointer for show/do requests, a check for a
 * screen-access request or a waiting-for-user placeholder), the sender label as an aria-label, the body,
 * the allow/deny controls of a screen-access request, and a done/failed/stopped glyph in the tenant
 * accent at a per-status opacity. The last message fades in.
 *
 * **Memoized, and `isTaskRunning` arrives as a prop rather than through `useWidget()`.** `MessageList`
 * commits a whole new `messages` array on every `chat/delta` token (`ChatContext`'s reducer keeps
 * reference equality for every message except the one being streamed into), so a `useWidget()`/
 * `useChatContext()` call anywhere inside a list row re-subscribes that row to the token stream directly
 * and defeats `React.memo` regardless of props — measured at ~21 `MessageItem`/`MessageBody` renders per
 * token in a 20-message transcript before this change (one per row), ~1 after (only the streaming row).
 * `onScreenAccessAllow`/`onScreenAccessDeny` must stay referentially stable (`ChatView`'s `useScreenShare`
 * wraps them for exactly this) or the memo comparison never bails.
 *
 * `MessageBody` renders the message's `parts` — text and progress lines — and `Thinking` is the
 * spinner-and-caption row shown while a reply is pending, its caption switching to name the visitor's
 * action when the agent is blocked on them. Thinking shows while a placeholder carries no text yet, and
 * also while the task is still running on the LAST show/do message, where text has already arrived but
 * more work is coming; a message with no parts at all falls back to a bare `Surface`.
 */
import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { useWidgetConfig } from '../../hooks/useWidget';
import { type ChatMessage, messageText } from '../../types';
import { formatMessageTime } from '../../utils/chat';
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
  onScreenAccessAllow?: () => void;
  onScreenAccessDeny?: () => void;
}

const STATUS_ICONS: Record<NonNullable<ChatMessage['taskStatus']>, { name: IconName; opacity: number }> = {
  done: { name: 'checkCircle', opacity: 1 },
  failed: { name: 'exclamationCircle', opacity: 0.75 },
  stopped: { name: 'circle', opacity: 0.5 },
};

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
  const isWaitingForUser = message.placeholderState === 'waiting-for-user';
  const stillWorking = isTaskRunning && isLastMessage && (message.mode === 'show' || message.mode === 'do');

  if (message.parts.length === 0) {
    return message.isPlaceholder || stillWorking ? <Thinking isWaitingForUser={isWaitingForUser} /> : <Surface />;
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
        if (part.type === 'progress') {
          return (
            <Flex key={`part-${index}`} align='start' gap='md'>
              <Text as='span' size='xs' weight='medium' style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                {part.content}
              </Text>
            </Flex>
          );
        }
        return null;
      })}

      {((message.isPlaceholder && !message.parts.some(p => p.type === 'text')) || stillWorking) && (
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

  if (message.isSystemMessage) {
    return (
      <Flex justify='center' align='center'>
        <Text as='span' variant='faint' weight='normal' style={{ fontSize: '10px' }}>
          {messageText(message.parts)}
        </Text>
      </Flex>
    );
  }

  const isUser = message.sender === 'user';
  const leadingIcon = isUser
    ? message.mode === 'show' || message.mode === 'do'
      ? ('mousePointerClick' as const)
      : undefined
    : message.isScreenAccessRequest || message.placeholderState === 'waiting-for-user'
      ? ('checkCircle' as const)
      : undefined;
  const status = !isUser && message.taskStatus ? STATUS_ICONS[message.taskStatus] : undefined;

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
            padding: message.videoStream ? '0' : '8px 10px',
            border: '1px solid transparent',
            backgroundColor: isUser ? 'var(--primary)' : undefined,
            color: isUser ? 'var(--primary-foreground)' : 'var(--foreground)',
          }}
        >
          {message.videoStream && <VideoStreamDisplay stream={message.videoStream} />}
          {!message.videoStream &&
            (leadingIcon ? (
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
            ))}

          {message.isScreenAccessRequest && !message.screenShareStatus && (
            <Flex align='center' gap='sm' style={{ marginTop: '6px' }}>
              <Button variant='primary' size='sm' shape='pill' onClick={() => onScreenAccessAllow?.()}>
                Yes
              </Button>
              <Button variant='secondary' size='sm' shape='pill' onClick={() => onScreenAccessDeny?.()}>
                No
              </Button>
            </Flex>
          )}

          {message.isScreenAccessRequest && message.screenShareStatus && (
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
      {!message.isPlaceholder && (
        <Text as='div' variant='faint' size='xxs' align='right' style={{ marginTop: '2px', marginRight: '26px' }}>
          {formatMessageTime(message.timestamp)}
        </Text>
      )}
    </Stack>
  );
};

export const MessageItem = React.memo(MessageItemComponent);

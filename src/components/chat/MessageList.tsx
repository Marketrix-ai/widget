/**
 * The chat transcript pane: a scrolling `role='log'` list of `MessageItem`s with the "Clear conversation"
 * action beneath it and two floating scroll affordances layered over it.
 *
 * `scrollButtonStyle` is the card-on-surface look shared by both affordances. `MessageListProps` carries
 * the end-of-list anchor ref owned by `ChatView` plus the screen-access answers, forwarded only to
 * `MessageItem`. `MessageList` prepends a greeting message built from `widget_body` through the shared
 * `createAgentMessage`, the one home for a `ChatMessage`; it never enters the store, which is why
 * "Clear conversation" is gated on `messages.length` rather than on the rendered list. `handleScroll` derives both affordances from container geometry — top once scrolled past
 * 200px, bottom while the list overflows and sits more than 50px off the end. The transcript paints
 * `widget_background_color` through `backgroundGradient`, the one home for that expansion, zeroing
 * `backgroundColor` for a gradient setting so the two declarations cannot fight.
 *
 * Every scroll is suppressed in preview mode: there the widget is embedded in the dashboard's modal, and
 * `scrollIntoView` would scroll that parent modal rather than this list. The scroll on a new message waits
 * a `requestAnimationFrame` so layout has settled before it fires. A streaming reply arrives as
 * `chat/delta` fragments that grow the last message in place without changing the message count, so a
 * second effect keys on that message's content length and re-pins to the bottom only while the reader is
 * already within 120px of it — a reader who scrolled away is left where they are.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { SHADOW } from '../../design-system/component-tokens';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { ChatMessage } from '../../types';
import { createAgentMessage } from '../../utils/chat';
import { addOpacity, backgroundGradient } from '../../utils/color';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { MessageItem } from './MessageItem';

const scrollButtonStyle: React.CSSProperties = {
  boxShadow: SHADOW.button,
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  pointerEvents: 'auto',
};

interface MessageListProps {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onScreenAccessAllow: () => void;
  onScreenAccessDeny: () => void;
}

export const MessageList = ({ messagesEndRef, onScreenAccessAllow, onScreenAccessDeny }: MessageListProps) => {
  const widgetConfig = useWidgetConfig();
  const { state, actions } = useWidget();
  const { messages } = state;
  const { isPreviewMode } = widgetConfig;
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const greetingMessage = useMemo(() => createAgentMessage(widgetConfig.widget_body), [widgetConfig.widget_body]);
  const allMessages = useMemo(() => [greetingMessage, ...messages], [greetingMessage, messages]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      setShowScrollTop(scrollTop > 200);

      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      setShowScrollBottom(!isAtBottom && scrollHeight > clientHeight);
    }
  };

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        !isPreviewMode && messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        !isPreviewMode && handleScroll();
      }
    });
  }, [messages.length, isPreviewMode]);

  const lastContentLength = messages[messages.length - 1]?.content?.length ?? 0;
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isPreviewMode) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isAtBottom) {
      window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }));
    }
  }, [lastContentLength, isPreviewMode, messagesEndRef]);

  return (
    <Surface position='relative' height='full'>
      <Surface
        key='message-list-container'
        ref={containerRef as React.RefObject<HTMLDivElement>}
        onScroll={handleScroll}
        role='log'
        aria-relevant='additions'
        height='full'
        overflowY='auto'
        paddingX='lg'
        paddingY='sm'
        style={{
          backgroundColor: widgetConfig.widget_background_color.includes('gradient')
            ? 'transparent'
            : widgetConfig.widget_background_color,
          backgroundImage: backgroundGradient(widgetConfig.widget_background_color),
          scrollbarColor: `${addOpacity(widgetConfig.widget_border_color, 0.3)} ${addOpacity(widgetConfig.widget_border_color, 0.1)}`,
          scrollbarWidth: 'thin',
        }}
      >
        {allMessages.map((message: ChatMessage, index: number) => (
          <MessageItem
            key={`message-${message.id}-${index}`}
            message={message}
            isLastMessage={index === allMessages.length - 1}
            onScreenAccessAllow={onScreenAccessAllow}
            onScreenAccessDeny={onScreenAccessDeny}
          />
        ))}

        {messages.length > 0 && (
          <Flex justify='center' style={{ marginTop: '12px', marginBottom: '4px' }}>
            <Button type='button' variant='bare' onClick={actions.clearChatHistory}>
              <Text size='xs' variant='muted' style={{ cursor: 'pointer' }}>
                Clear conversation
              </Text>
            </Button>
          </Flex>
        )}

        <Surface key='scroll-anchor' ref={messagesEndRef as React.RefObject<HTMLDivElement>} />
      </Surface>

      {[
        {
          show: showScrollTop,
          edge: { top: '8px' },
          label: 'Scroll to top',
          icon: 'arrowUp' as const,
          onClick: () => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }),
        },
        {
          show: showScrollBottom,
          edge: { bottom: '8px' },
          label: 'Scroll to bottom',
          icon: 'arrowDown' as const,
          onClick: () => !isPreviewMode && messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }),
        },
      ].map(
        ({ show, edge, label, icon, onClick }) =>
          show && (
            <Flex
              key={label}
              position='absolute'
              justify='center'
              style={{ ...edge, left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}
            >
              <IconButton variant='secondary' size='sm' label={label} onClick={onClick} style={scrollButtonStyle}>
                <Icon name={icon} size={10} style={{ color: widgetConfig.widget_accent_color }} />
              </IconButton>
            </Flex>
          ),
      )}
    </Surface>
  );
};

/**
 * The chat transcript pane: a scrolling list of `MessageItem`s with a "Clear chat" action and
 * two floating scroll affordances (scroll-to-top, scroll-to-bottom) layered over it.
 *
 * `MessageList` prepends a greeting message built from `widget_body`, which never enters the store —
 * that's why "Clear chat" is gated on the store's own message count. `handleScroll` shows each
 * affordance based on scroll position. All scrolling is suppressed in preview mode, where the widget is
 * embedded in the dashboard's own modal and scrolling would move that modal instead of this list. A
 * streaming reply re-pins to the bottom only while the reader was already near it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { SHADOW } from '../../design-system/component-tokens';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import { type ChatMessage, messageText } from '../../types';
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

export const MessageList = ({ messagesEndRef }: { messagesEndRef: React.RefObject<HTMLDivElement | null> }) => {
  const widgetConfig = useWidgetConfig();
  const { state, actions } = useWidget();
  const { messages, isTaskRunning } = state;
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
  }, [messages.length, isPreviewMode, messagesEndRef]);

  const lastMessage = messages[messages.length - 1];
  const lastContentLength = lastMessage ? messageText(lastMessage.parts).length : 0;
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
        ref={containerRef}
        onScroll={handleScroll}
        role='log'
        aria-relevant='additions'
        height='full'
        overflowY='auto'
        paddingX='lg'
        paddingY='sm'
        style={{
          backgroundImage: backgroundGradient(widgetConfig.widget_background_color),
          scrollbarColor: `${addOpacity(widgetConfig.widget_border_color, 0.3)} ${addOpacity(widgetConfig.widget_border_color, 0.1)}`,
          scrollbarWidth: 'thin',
        }}
      >
        {allMessages.map((message: ChatMessage, index: number) => (
          <MessageItem
            key={message.id}
            message={message}
            isLastMessage={index === allMessages.length - 1}
            isTaskRunning={isTaskRunning}
            onScreenAccessAllow={actions.allowScreenAccess}
            onScreenAccessDeny={actions.denyScreenAccess}
          />
        ))}

        {messages.length > 0 && (
          <Flex justify='center' style={{ marginTop: '12px', marginBottom: '4px' }}>
            <Button variant='bare' onClick={actions.clearChatHistory}>
              <Text size='xs' variant='muted' style={{ cursor: 'pointer' }}>
                Clear chat
              </Text>
            </Button>
          </Flex>
        )}

        <Surface key='scroll-anchor' ref={messagesEndRef} />
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

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { SHADOW } from '../../design-system/shadows';
import { useWidget } from '../../hooks/useWidget';
import type { ChatMessage, MarketrixConfig } from '../../types';
import { addOpacity } from '../../utils/color';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { StateMessage } from '../ui/StateMessage';
import { MessageItem } from './MessageItem';

const scrollButtonStyle: React.CSSProperties = {
  boxShadow: SHADOW.button,
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  pointerEvents: 'auto',
};

interface MessageListProps {
  messages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  config?: MarketrixConfig;
  onScreenAccessAllow?: () => void;
  onScreenAccessDeny?: () => void;
  onClearChat?: () => void | Promise<void>;
}

export const MessageList = ({
  messages,
  messagesEndRef,
  config,
  onScreenAccessAllow,
  onScreenAccessDeny,
  onClearChat,
}: MessageListProps) => {
  const { config: widgetConfig, state: widgetState, isPreviewMode } = useWidget({ config });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const greetingMessage = useMemo<ChatMessage>(
    () => ({
      id: 'welcome',
      content: widgetConfig.widget_body ?? 'How can I help you today?',
      sender: 'agent',
      timestamp: new Date(),
      isPlaceholder: false,
    }),
    [widgetConfig.widget_body],
  );
  const allMessages = useMemo(() => [greetingMessage, ...messages], [greetingMessage, messages]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      setShowScrollTop(scrollTop > 200);

      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      setShowScrollBottom(!isAtBottom && scrollHeight > clientHeight);
    }
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Skip in preview mode to prevent scrolling the parent modal
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      !isPreviewMode && messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // rAF so the DOM is laid out and scroll height is final before we scroll
    window.requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        !isPreviewMode && messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        !isPreviewMode && handleScroll();
      }
    });
  }, [messages.length, isPreviewMode]); // Run when messages length changes to handle history loading

  // Follow a streaming reply: when the last message's content grows (chat/delta accumulation),
  // keep the view pinned to the bottom — but only if the user hasn't scrolled away.
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
          backgroundImage: widgetConfig.widget_background_color.includes('gradient')
            ? widgetConfig.widget_background_color
            : `linear-gradient(135deg, ${widgetConfig.widget_background_color} 0%, ${widgetConfig.widget_background_color} 100%)`,
          scrollbarColor: `${addOpacity(widgetConfig.widget_border_color, 0.3)} ${addOpacity(widgetConfig.widget_border_color, 0.1)}`,
          scrollbarWidth: 'thin',
        }}
      >
        {messages.length === 0 && widgetState.isLoading && <StateMessage variant='loading' message='Connecting…' />}

        {allMessages.map((message: ChatMessage, index: number) => (
          <MessageItem
            key={`message-${message.id}-${index}`}
            message={message}
            index={index}
            isLastMessage={index === allMessages.length - 1}
            onScreenAccessAllow={onScreenAccessAllow}
            onScreenAccessDeny={onScreenAccessDeny}
          />
        ))}

        {messages.length > 0 && onClearChat && (
          <Flex justify='center' style={{ marginTop: '12px', marginBottom: '4px' }}>
            <Button
              type='button'
              variant='bare'
              onClick={() => {
                const result = onClearChat();
                if (result instanceof Promise) result.catch(e => console.error(e));
              }}
            >
              <Text size='xs' variant='muted' style={{ cursor: 'pointer' }}>
                Clear conversation
              </Text>
            </Button>
          </Flex>
        )}

        <Surface key='scroll-anchor' ref={messagesEndRef as React.RefObject<HTMLDivElement>} />
      </Surface>

      {showScrollTop && (
        <Flex
          position='absolute'
          justify='center'
          style={{ top: '8px', left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}
        >
          <IconButton
            variant='secondary'
            size='sm'
            label='Scroll to top'
            onClick={scrollToTop}
            style={scrollButtonStyle}
          >
            <Icon name='arrowUp' size={10} style={{ color: widgetConfig.widget_accent_color }} />
          </IconButton>
        </Flex>
      )}

      {showScrollBottom && (
        <Flex
          position='absolute'
          justify='center'
          style={{ bottom: '8px', left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}
        >
          <IconButton
            variant='secondary'
            size='sm'
            label='Scroll to bottom'
            onClick={scrollToBottom}
            style={scrollButtonStyle}
          >
            <Icon name='arrowDown' size={10} style={{ color: widgetConfig.widget_accent_color }} />
          </IconButton>
        </Flex>
      )}
    </Surface>
  );
};

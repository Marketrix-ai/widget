// / <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';

import { SHADOW } from '../../design-system/shadows';
import { useWidget } from '../../hooks/useWidget';
import type { ChatMessage, MarketrixConfig } from '../../types';
import { addOpacity } from '../../utils/format';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { StateMessage } from '../ui/StateMessage';
import { MessageItem } from './MessageItem';

const scrollButtonStyle: React.CSSProperties = {
  padding: '6px',
  borderRadius: '9999px',
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
  // Get widget config and state
  const { config: widgetConfig, state: widgetState, isPreviewMode } = useWidget({ config });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle scroll visibility
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Show top button if scrolled down more than 200px
      setShowScrollTop(scrollTop > 200);

      // Show bottom button if not at the bottom (with 50px threshold)
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      setShowScrollBottom(!isAtBottom && scrollHeight > clientHeight);
    }
  };

  // Scroll to top handler
  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to bottom handler
  // Skip in preview mode to prevent scrolling the parent modal
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      !isPreviewMode && messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Force scroll to bottom on mount (restoring history)
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is fully rendered
    // and scroll height is calculated correctly
    window.requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        !isPreviewMode && messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        !isPreviewMode && handleScroll();
      }
    });
  }, [messages.length, isPreviewMode]); // Run when messages length changes to handle history loading

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
        {/* Initial loading state when no messages yet */}
        {messages.length === 0 && widgetState.isLoading && <StateMessage variant='loading' message='Connecting…' />}

        {/* Messages (greeting prepended as first agent message) */}
        {[
          {
            id: 'welcome',
            content: widgetConfig.widget_body ?? 'How can I help you today?',
            sender: 'agent' as const,
            timestamp: new Date(),
            isPlaceholder: false,
          } satisfies ChatMessage,
          ...messages,
        ].map((message: ChatMessage, index: number, allMessages: ChatMessage[]) => (
          <MessageItem
            key={`message-${message.id}-${index}`}
            message={message}
            index={index}
            isLastMessage={index === allMessages.length - 1}
            widgetState={widgetState}
            onScreenAccessAllow={onScreenAccessAllow}
            onScreenAccessDeny={onScreenAccessDeny}
          />
        ))}

        {/* Clear conversation footer */}
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

        {/* Auto-scroll anchor */}
        <Surface key='scroll-anchor' ref={messagesEndRef as React.RefObject<HTMLDivElement>} />
      </Surface>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Flex
          position='absolute'
          justify='center'
          style={{ top: '8px', left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}
        >
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={scrollToTop}
            style={scrollButtonStyle}
            title='Scroll to top'
            aria-label='Scroll to top'
          >
            <Icon name='arrowUp' size={10} style={{ color: widgetConfig.widget_accent_color }} />
          </Button>
        </Flex>
      )}

      {showScrollBottom && (
        <Flex
          position='absolute'
          justify='center'
          style={{ bottom: '8px', left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}
        >
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={scrollToBottom}
            style={scrollButtonStyle}
            title='Scroll to bottom'
            aria-label='Scroll to bottom'
          >
            <Icon name='arrowDown' size={10} style={{ color: widgetConfig.widget_accent_color }} />
          </Button>
        </Flex>
      )}
    </Surface>
  );
};

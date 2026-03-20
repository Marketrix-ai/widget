// / <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';
import { FaArrowDown, FaArrowUp } from 'react-icons/fa';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { useWidget } from '../../hooks/useWidget';
import type { ChatMessage, MarketrixConfig } from '../../types';
import { addOpacity } from '../../utils/format';
import { Button } from '../base/Button';
import { StateMessage } from '../ui/StateMessage';
import { MessageItem } from './MessageItem';
import { WelcomeMessage } from './WelcomeMessage';

interface MessageListProps {
  messages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSendMessage?: (message: string, mode?: 'show' | 'tell' | 'do', applicationId?: number, question?: string) => void;
  onSetMode?: (mode: 'show' | 'tell' | 'do') => void;
  onModeChange?: (mode: 'show' | 'tell' | 'do') => void;
  onAddMessage?: (message: ChatMessage) => void;
  config?: MarketrixConfig;
  onScreenAccessAllow?: () => void;
  onScreenAccessDeny?: () => void;
}

export const MessageList = ({
  messages,
  messagesEndRef,
  onSendMessage: _onSendMessage,
  onSetMode: _onSetMode,
  onModeChange: _onModeChange,
  onAddMessage: _onAddMessage,
  config,
  onScreenAccessAllow,
  onScreenAccessDeny,
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
    <div className='relative h-full'>
      <div
        key='message-list-container'
        ref={containerRef}
        onScroll={handleScroll}
        role='log'
        aria-relevant='additions'
        className='h-full overflow-y-auto px-2 space-y-0.5 pt-0 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-400'
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

        {/* Welcome message - always show */}
        <WelcomeMessage
          greeting={widgetConfig.widget_body ?? 'How can I help you today?'}
          settings={{
            widget_shadow: widgetConfig.widget_shadow,
            widget_border_radius: widgetConfig.widget_border_radius,
            widget_text_color: widgetConfig.widget_text_color,
            widget_border_color: widgetConfig.widget_border_color,
            widget_secondary_color: widgetConfig.widget_secondary_color,
          }}
        />

        {/* Messages */}
        {messages.map((message: ChatMessage, index: number) => (
          <MessageItem
            key={`message-${message.id}-${index}`}
            message={message}
            index={index}
            isLastMessage={index === messages.length - 1}
            widgetState={widgetState}
            settings={{
              widget_accent_color: widgetConfig.widget_accent_color,
              widget_text_color: widgetConfig.widget_text_color,
              widget_border_color: widgetConfig.widget_border_color,
              widget_shadow: widgetConfig.widget_shadow,
              widget_border_radius: widgetConfig.widget_border_radius,
            }}
            marketrixIcon={MarketrixIcon}
            onScreenAccessAllow={onScreenAccessAllow}
            onScreenAccessDeny={onScreenAccessDeny}
          />
        ))}

        {/* Auto-scroll anchor */}
        <div key='scroll-anchor' ref={messagesEndRef} />
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <div className='absolute top-2 left-0 right-0 flex justify-center z-10 pointer-events-none'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={scrollToTop}
            className='p-1.5 rounded-full shadow-md bg-white/90 hover:bg-white border border-gray-200 pointer-events-auto'
            style={{ border: '1px solid #e5e7eb' }}
            title='Scroll to top'
            aria-label='Scroll to top'
          >
            <FaArrowUp className='w-2.5 h-2.5' style={{ color: widgetConfig.widget_accent_color }} />
          </Button>
        </div>
      )}

      {showScrollBottom && (
        <div className='absolute bottom-2 left-0 right-0 flex justify-center z-10 pointer-events-none'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={scrollToBottom}
            className='p-1.5 rounded-full shadow-md bg-white/90 hover:bg-white border border-gray-200 pointer-events-auto'
            style={{ border: '1px solid #e5e7eb' }}
            title='Scroll to bottom'
            aria-label='Scroll to bottom'
          >
            <FaArrowDown className='w-2.5 h-2.5' style={{ color: widgetConfig.widget_accent_color }} />
          </Button>
        </div>
      )}
    </div>
  );
};

// / <reference lib="dom" />
import React from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import MarketrixIcon from '../../assets/marketrix-icon.png';
import { useWidget } from '../../hooks/useWidget';
import { createUserMessage } from '../../services/features/ChatService';
import type { ChatMessage, MarketrixConfig } from '../../types';
import { addOpacity } from '../../utils/format/colorUtils';
import { parseProgressLines } from '../../utils/messageContentUtils';
import { MessageItem } from './messageItem';
import { WelcomeMessage } from './welcomeMessage';

// Define the chip type to handle both formats
type ChipData = {
  chip_mode?: 'show' | 'tell' | 'do' | string;
  chip_text?: string;
  type?: 'show' | 'tell' | 'do' | string;
  question?: string;
};

interface MessageListProps {
  messages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSendMessage?: (
    message: string,
    mode?: 'show' | 'tell' | 'do',
    connectionId?: number,
    question?: string
  ) => void;
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
  onSendMessage,
  onSetMode,
  onModeChange,
  onAddMessage,
  config,
  onScreenAccessAllow,
  onScreenAccessDeny,
}: MessageListProps) => {
  // Get widget settings and state
  const { settings, state: widgetState } = useWidget(config ? { config } : {});

  // Check if there's a pending message (placeholder exists or isLoading)
  const hasPendingMessage = widgetState.isLoading || messages.some((msg) => msg.isPlaceholder);

  // Suggested actions to show when no messages - get from settings or use defaults
  const getSuggestedActions = () => {
    // If settings have widget_chips, use those
    if (settings?.widget_chips && settings.widget_chips.length > 0) {
      return settings.widget_chips.map((chip: ChipData, index: number) => {
        // Handle both formats: chip_text (expected) and question (actual backend)
        const chipText = chip.chip_text || chip.question || '';
        const chipMode = chip.chip_mode || chip.type || 'tell';
        const mode: 'show' | 'tell' | 'do' =
          chipMode === 'show' || chipMode === 'tell' || chipMode === 'do' ? chipMode : 'tell';

        let icon;
        let isShow = false;

        switch (mode) {
          case 'do':
            icon = (
              <SiTicktick
                className='w-3 h-3 text-xs'
                style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
              />
            );
            isShow = false;
            break;
          case 'show':
            icon = (
              <LuMousePointerClick
                className='w-3 h-3 text-xs'
                style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
              />
            );
            isShow = true;
            break;
          case 'tell':
            icon = (
              <IoChatbubbleEllipsesOutline
                className='w-3 h-3 text-xs'
                style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
              />
            );
            isShow = false;
            break;
          default:
            icon = (
              <IoChatbubbleEllipsesOutline
                className='w-3 h-3 text-xs'
                style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
              />
            );
            isShow = false;
        }

        // Create a unique ID using the chip content and index
        const uniqueId = `chip-${chipText.replace(/\s+/g, '-').toLowerCase()}-${index}`;

        return {
          id: uniqueId,
          text: chipText,
          icon,
          type: mode,
          isShow,
        };
      });
    }

    return [
      {
        id: 'show-add-product',
        text: 'Show me how to add a new product',
        icon: <LuMousePointerClick className='w-6 h-6' />,
        type: 'show' as const,
        isShow: true,
      },
      {
        id: 'show-login',
        text: 'Show me how to login',
        icon: <LuMousePointerClick className='w-6 h-6' />,
        type: 'show' as const,
        isShow: true,
      },
      {
        id: 'do-login',
        text: 'Do the login process for me',
        icon: <SiTicktick className='w-4 h-4' />,
        type: 'do' as const,
        isShow: false,
      },
      {
        id: 'show-revenue',
        text: 'Show me the revenue metrics',
        icon: <LuMousePointerClick className='w-6 h-6' />,
        type: 'show' as const,
        isShow: true,
      },
      {
        id: 'tell-conversion-rate',
        text: 'What does my conversion rate mean and how can I improve it?',
        icon: <IoChatbubbleEllipsesOutline className='w-5 h-5' />,
        type: 'tell' as const,
        isShow: false,
      },
    ];
  };

  const suggestedActions = getSuggestedActions();
  const seenIds = new Set();
  interface SuggestedActionItem {
    id: string;
    text: string;
    icon: React.ReactElement;
    type: 'tell' | 'show' | 'do';
    isShow: boolean;
  }

  const uniqueSuggestedActions = suggestedActions.map((action: SuggestedActionItem) => {
    let uniqueId = action.id;
    let counter = 0;
    while (seenIds.has(uniqueId)) {
      counter++;
      uniqueId = `${action.id}-${counter}`;
    }
    seenIds.add(uniqueId);

    if (counter > 0) {
      console.warn(`Duplicate ID found: ${action.id}, using: ${uniqueId}`);
    }

    return {
      ...action,
      id: uniqueId,
    };
  });

  const handleSuggestedActionClick = async (
    action: (typeof suggestedActions)[0],
    event: React.MouseEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // Don't allow clicking chips when there's a pending message
    if (hasPendingMessage) {
      return;
    }

    // FIRST: Switch to the chip's mode if not already in that mode
    // Use onModeChange if available (adds system message), otherwise fall back to onSetMode
    if (action.type) {
      if (onModeChange) {
        // onModeChange adds system message and switches mode
        console.log('Changing mode to:', action.type);
        onModeChange(action.type);
      } else if (onSetMode) {
        // Fallback to direct mode set
        console.log('Setting mode to:', action.type);
        onSetMode(action.type);
      }

      // Wait a tick to ensure mode change is processed and UI updates
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // THEN: Add the chip message as a user message in the chat (like user typed it)
    // The greeting message and all existing messages remain unchanged
    if (onAddMessage) {
      // We import createUserMessage from ChatService now (exported function)
      const userMessage = createUserMessage(action.text, action.type, 'chip-message');
      onAddMessage(userMessage);
    }

    // Send message through normal flow (will check for screen access if needed)
    // This ensures chips get the same treatment as typing a message
    if (onSendMessage) {
      console.log('Sending message with mode:', action.type, action.text);
      // The wrapper in ChatWindow will handle screen access check
      onSendMessage(action.text, action.type);
    }
  };

  return (
    <div
      key='message-list-container'
      className={`
            h-full overflow-y-auto px-2 space-y-0.5
            scrollbar-thin scrollbar-track-[#f6f6f6] scrollbar-thumb-[#b6b6b6]
          `}
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: settings.widget_background_color.includes('gradient')
          ? settings.widget_background_color
          : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
        scrollbarColor: `${addOpacity(settings.widget_border_color, 0.3)} ${addOpacity(settings.widget_border_color, 0.1)}`,
        scrollbarWidth: 'thin',
      }}
    >
      {/* Welcome message - always show */}
      <WelcomeMessage
        greeting={settings.widget_greeting}
        settings={settings}
        marketrixIcon={MarketrixIcon}
        suggestedActions={uniqueSuggestedActions}
        hasPendingMessage={hasPendingMessage}
        onActionClick={handleSuggestedActionClick}
      />

      {/* Messages */}
      {(() => {
        // Debug: Log messages being rendered
        const messagesWithProgress = messages.filter((msg) => {
          const { progressLines } = parseProgressLines(msg.content);
          return progressLines.length > 0;
        });
        if (messagesWithProgress.length > 0) {
          console.log('[MessageList] [FLOW] Rendering messages with progress', {
            totalMessages: messages.length,
            messagesWithProgress: messagesWithProgress.length,
            progressMessages: messagesWithProgress.map((msg) => ({
              id: msg.id,
              content: msg.content,
              progressLines: parseProgressLines(msg.content).progressLines,
            })),
          });
        }
        return null;
      })()}
      {messages.map((message: ChatMessage, index: number) => (
        <MessageItem
          key={`message-${message.id}-${index}`}
          message={message}
          index={index}
          widgetState={widgetState}
          settings={settings}
          marketrixIcon={MarketrixIcon}
          onScreenAccessAllow={onScreenAccessAllow}
          onScreenAccessDeny={onScreenAccessDeny}
        />
      ))}

      {/* Auto-scroll anchor */}
      <div key='scroll-anchor' ref={messagesEndRef} />
    </div>
  );
};

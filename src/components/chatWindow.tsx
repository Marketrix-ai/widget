import React, { useEffect, useRef, useState } from 'react';

import MarketrixIcon from '../assets/marketrix-icon.png';
import { useWidget } from '../hooks/useWidget';
import type { ChatMessage, ChatMode, MarketrixConfig } from '../types';
import { getPositionClasses } from '../utils/widgetPositioning';
import { MessageInput } from './messageInput';
import { MessageList } from './messageList';
import { ModeSelector } from './modeSelector';

interface ChatWindowProps {
  config: MarketrixConfig;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: ChatMode;
  agentAvailable: boolean;
  onClose: () => void;
  onSendMessage: (
    message: string,
    mode?: ChatMode,
    connectionId?: number,
    question?: string,
    skipUserMessage?: boolean
  ) => void;
  onSetMode: (mode: ChatMode) => void;
  onAddMessage: (message: ChatMessage) => void;
  onUpdateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  onScreenSharingChange?: (isSharing: boolean) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  config,
  isOpen,
  isMinimized,
  isLoading,
  messages,
  currentMode,
  onClose,
  onSendMessage,
  onSetMode,
  onAddMessage,
  onUpdateMessage,
  onScreenSharingChange,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareMessageId, setScreenShareMessageId] = useState<string | null>(null);
  const [screenAccessRequestMessageId, setScreenAccessRequestMessageId] = useState<string | null>(
    null
  );
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    mode?: ChatMode;
    connectionId?: number;
    question?: string;
    alreadyAdded?: boolean;
  } | null>(null);

  // Get atmosphere configuration
  const { getWidgetCustomize, getWidgetPosition, settings } = useWidget({ config });

  const widgetCustomize = getWidgetCustomize();
  const widgetPosition = getWidgetPosition();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() && !isLoading) {
      const messageContent = inputValue.trim();
      setInputValue('');

      // Add user message immediately (like user typed it)
      const userMessage: ChatMessage = {
        id: `user-message-${Date.now()}`,
        content: messageContent,
        sender: 'user',
        timestamp: new Date(),
        mode: currentMode,
      };
      onAddMessage(userMessage);

      // Check if screen sharing is needed for show/do modes
      if (
        (currentMode === 'show' || currentMode === 'do') &&
        !isScreenSharing &&
        !screenAccessRequestMessageId
      ) {
        // Store the pending message and show screen access request
        // alreadyAdded=true because we just added the message above
        setPendingMessage({ content: messageContent, mode: currentMode, alreadyAdded: true });
        requestScreenAccess(currentMode);
      } else {
        // Send message directly (message already added above, so skip adding it again)
        // @ts-ignore - skipUserMessage parameter exists but not in type definition
        onSendMessage(messageContent, currentMode, undefined, undefined, true);
      }
    }
  };

  const requestScreenAccess = (mode: ChatMode) => {
    if (screenAccessRequestMessageId) return; // Already requesting

    const requestMessageId = `screen-access-request-${Date.now()}`;
    setScreenAccessRequestMessageId(requestMessageId);

    const screenAccessRequestMessage: ChatMessage = {
      id: requestMessageId,
      content: 'Can I take a look at your screen?',
      sender: 'agent',
      timestamp: new Date(),
      mode,
      isScreenAccessRequest: true,
    };

    onAddMessage(screenAccessRequestMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleModeChange = (mode: ChatMode) => {
    // If clicking the same mode, preserve current selection (don't toggle off screen sharing)
    if (mode === currentMode) {
      return;
    }

    // Add system message for mode change
    const modeDisplayNames: Record<ChatMode, string> = {
      show: 'Show',
      tell: 'Tell',
      do: 'Do',
    };

    const systemMessage: ChatMessage = {
      id: `mode-change-${Date.now()}`,
      content: `Switched to ${modeDisplayNames[mode]} mode`,
      sender: 'agent',
      timestamp: new Date(),
      mode,
      isSystemMessage: true,
    };

    onAddMessage(systemMessage);

    // Change mode without affecting screen sharing
    onSetMode(mode);
  };

  const handleScreenAccessAllow = async () => {
    try {
      // Request screen share with preferCurrentTab option - WAIT for permission first
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);

      // Only proceed if permission was granted (stream exists)
      if (!stream || stream.getVideoTracks().length === 0) {
        // No permission granted
        if (screenAccessRequestMessageId) {
          onUpdateMessage(screenAccessRequestMessageId, {
            content: 'Can I take a look at your screen? ✗ No permission',
          });
          setScreenAccessRequestMessageId(null);
        }
        // Clear pending message
        setPendingMessage(null);
        return;
      }

      // Permission granted - update UI and proceed
      setScreenStream(stream);
      setIsScreenSharing(true);
      onScreenSharingChange?.(true);

      // Mark the screen access request as handled (but keep it as a screen access request so greeting stays)
      if (screenAccessRequestMessageId) {
        onUpdateMessage(screenAccessRequestMessageId, {
          content: 'Can I take a look at your screen? ✓',
        });
        setScreenAccessRequestMessageId(null);
      }

      // Create a screenshare message
      const messageId = `screenshare-${Date.now()}`;
      setScreenShareMessageId(messageId);

      // Add screenshare message to messages
      const screenshareMessage: ChatMessage = {
        id: messageId,
        content: 'Started screenshare',
        sender: 'user',
        timestamp: new Date(),
        mode: 'show',
        videoStream: stream,
      };

      // Add message using the callback
      onAddMessage(screenshareMessage);

      // Send pending message if there is one (only after permission is granted)
      // Pass skipUserMessage based on whether message was already added
      if (pendingMessage) {
        const message = pendingMessage;
        setPendingMessage(null);
        // @ts-ignore - skipUserMessage parameter exists but not in type definition
        onSendMessage(
          message.content,
          message.mode,
          message.connectionId,
          message.question,
          message.alreadyAdded
        );
      }

      // Handle stream end (user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenSharing();
      });
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      setIsScreenSharing(false);
      onScreenSharingChange?.(false);

      // Permission denied or error - update message and clear pending
      if (screenAccessRequestMessageId) {
        onUpdateMessage(screenAccessRequestMessageId, {
          content: 'Can I take a look at your screen? ✗ No permission',
        });
        setScreenAccessRequestMessageId(null);
      }
      // Clear pending message
      setPendingMessage(null);
    }
  };

  const handleScreenAccessDeny = () => {
    // Mark the screen access request as handled (but keep it as a screen access request so greeting stays)
    if (screenAccessRequestMessageId) {
      onUpdateMessage(screenAccessRequestMessageId, {
        content: 'Can I take a look at your screen? ✗',
      });
      setScreenAccessRequestMessageId(null);
    }

    // Clear pending message if user denies screen access
    setPendingMessage(null);
  };

  const stopScreenSharing = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
    onScreenSharingChange?.(false);

    // Remove video preview from the previous "Sharing screen" message
    if (screenShareMessageId) {
      onUpdateMessage(screenShareMessageId, {
        videoStream: undefined,
      });
    }

    // Add a new "Stopped screenshare" message
    const stoppedMessage: ChatMessage = {
      id: `stopped-sharing-${Date.now()}`,
      content: 'Stopped screenshare',
      sender: 'user',
      timestamp: new Date(),
      mode: 'show',
    };
    onAddMessage(stoppedMessage);

    setScreenShareMessageId(null);
    // Keep the current mode selection - don't change it
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [screenStream]);

  // Get widget settings for positioning
  const effectivePosition = widgetPosition.position || settings.widget_position || 'bottom_right';
  const positionClasses = getPositionClasses(effectivePosition);

  if (!isOpen) return null;

  // Apply custom styling from settings
  const customStyles = {
    width: settings.widget_width || widgetCustomize.sizes?.width || '320px',
    height: isMinimized
      ? '48px'
      : settings.widget_height || widgetCustomize.sizes?.height || '35rem',
    borderRadius: settings.widget_border_radius || widgetCustomize.sizes?.border_radius || '12px',
    fontSize: settings.widget_font_size || widgetCustomize.sizes?.font_size || '14px',
    background: settings.widget_background_color || widgetCustomize.colors?.background || 'white',
    color: settings.widget_text_color || widgetCustomize.colors?.text || '#333333',
    borderColor:
      settings.widget_border_color || widgetCustomize.colors?.border || 'rgba(255, 255, 255, 0.2)',
    boxShadow: settings.widget_shadow || '0 10px 25px rgba(0, 0, 0, 0.1)',
    zIndex: widgetPosition.z_index || 40,
  } satisfies React.CSSProperties;

  return (
    <div
      className={`fixed bg-white rounded-xl ${positionClasses}`}
      style={{ zIndex: widgetPosition.z_index || 40 }}
    >
      <div
        className={`
          bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700
          w-[360px] max-w-sm
          ${isMinimized ? 'h-12' : 'h-[35rem]'} 
          transition-all duration-300 ease-in-out flex flex-col relative overflow-hidden
          ${isOpen ? 'animate-slide-up' : 'animate-slide-down'}
          transform-gpu
          shadow-2xl
          scrollbar-thin scrollbar-track-[#f6f6f6] scrollbar-thumb-[#b6b6b6]
        `}
        style={{
          ...customStyles,
          scrollbarColor: '#f6f6f6 #b6b6b6',
          scrollbarWidth: 'thin',
        }}
      >
        {/* Header with Marketrix branding */}
        <div
          className={`
              flex justify-between items-center px-3 py-1.5 relative border-b border-purple-200
              bg-purple-100 rounded-t-lg
                      `}
        >
          {/* Left side: Agent icon / Watching icon */}
          <div className='flex items-center gap-2'>
            {isScreenSharing ? (
              <button
                onClick={stopScreenSharing}
                className='flex items-center justify-center w-5 h-5 rounded-full transition-all shadow-sm hover:opacity-90'
                aria-label='Stop screen sharing'
                title='Stop screen sharing'
              >
                <div className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
              </button>
            ) : (
              <img src={MarketrixIcon} alt='Marketrix AI' className='w-5 h-5 object-cover' />
            )}
            <span className='text-sm font-semibold text-black leading-none'>Marketrix AI</span>
          </div>

          {/* Right side: Close button */}
          <div className='flex items-center space-x-1 bg-white/80 rounded-full p-0.5 shadow-sm'>
            <button
              onClick={onClose}
              className='p-1 rounded-full hover:bg-gray-100 transition-colors'
              aria-label='Close chat'
            >
              <svg className='w-3 h-3 text-gray-600' fill='currentColor' viewBox='0 0 20 20'>
                <path
                  fillRule='evenodd'
                  d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                  clipRule='evenodd'
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Content */}
        {!isMinimized && (
          <>
            {/* Chat Messages Area */}
            <div className='flex-1 overflow-hidden pt-3'>
              <MessageList
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                onSendMessage={(content, mode, connectionId, question) => {
                  // Check if screen sharing is needed for show/do modes
                  if (
                    (mode === 'show' || mode === 'do') &&
                    !isScreenSharing &&
                    !screenAccessRequestMessageId
                  ) {
                    // Store the pending message and show screen access request
                    // alreadyAdded=true because chip messages are already added to chat
                    setPendingMessage({
                      content,
                      mode,
                      connectionId,
                      question,
                      alreadyAdded: true,
                    });
                    requestScreenAccess(mode || currentMode);
                  } else {
                    // Send message directly (chip message already added, so skip adding it again)
                    // @ts-ignore - skipUserMessage parameter exists but not in type definition
                    onSendMessage(content, mode, connectionId, question, true);
                  }
                }}
                onSetMode={onSetMode}
                onModeChange={handleModeChange}
                onAddMessage={onAddMessage}
                config={config}
                onScreenAccessAllow={handleScreenAccessAllow}
                onScreenAccessDeny={handleScreenAccessDeny}
              />
            </div>

            {/* Controls Section */}
            <div className='flex-shrink-0 rounded-lg bg-white m-2'>
              {/* Input */}
              <MessageInput
                value={inputValue}
                onChange={setInputValue}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                isLoading={isLoading}
                config={config}
              />

              {/* Mode Selector */}
              <ModeSelector
                currentMode={currentMode}
                enabledModes={config.enabledModes || ['tell', 'show', 'do']}
                onModeChange={handleModeChange}
                isScreenSharing={isScreenSharing}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

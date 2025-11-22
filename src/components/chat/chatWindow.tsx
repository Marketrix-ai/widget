import React, { useEffect, useRef, useState } from 'react';

import { useWidget } from '../../hooks/useWidget';
import type { InstructionType } from '../../sdk';
import {
  isScreenSharing as isScreenSharingActive,
  startScreenShare,
  stopScreenShare,
} from '../../services/screenShareService';
import type { ChatMessage, MarketrixConfig, TaskProgress } from '../../types';
import { addOpacity, getContrastingColor } from '../../utils/colorUtils';
import {
  createScreenAccessRequestMessage,
  createScreenshareMessage,
  createStartedScreenshareMessage,
  createSystemMessage,
  createUserMessage,
} from '../../utils/messageFactory';
import { getPositionClasses } from '../../utils/widgetPositioning';
import { MessageInput } from '../input/messageInput';
import { ModeSelector } from '../input/modeSelector';
import { MessageList } from './messageList';

interface ChatWindowProps {
  config: MarketrixConfig;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
  agentAvailable: boolean;
  isTaskRunning?: boolean;
  taskProgress?: TaskProgress[];
  onClose: () => void;
  onSendMessage: (
    message: string,
    mode?: InstructionType,
    connectionId?: number,
    question?: string,
    skipUserMessage?: boolean
  ) => void;
  onSetMode: (mode: InstructionType) => void;
  onAddMessage: (message: ChatMessage) => void;
  onUpdateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  onRemoveMessage?: (messageId: string) => void;
  onStopTask?: () => void;
  onClearChat?: () => void | Promise<void>;
  onScreenSharingChange?: (isSharing: boolean) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  config,
  isOpen,
  isMinimized,
  isLoading,
  messages,
  currentMode,
  isTaskRunning = false,
  taskProgress = [],
  onClose,
  onSendMessage,
  onSetMode,
  onAddMessage,
  onUpdateMessage,
  onRemoveMessage,
  onStopTask,
  onClearChat,
  onScreenSharingChange,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareMessageId, setScreenShareMessageId] = useState<string | null>(null);
  const [screenAccessRequestMessageId, setScreenAccessRequestMessageId] = useState<string | null>(
    null
  );
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    mode?: InstructionType;
    connectionId?: number;
    question?: string;
    alreadyAdded?: boolean;
  } | null>(null);

  const { getWidgetPosition, settings } = useWidget({ config });
  const widgetPosition = getWidgetPosition();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track previous screenshare state to detect external stops
  const wasSharingRef = useRef(isScreenSharing);
  const screenShareMessageIdRef = useRef(screenShareMessageId);

  // Update refs when state changes
  useEffect(() => {
    wasSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  useEffect(() => {
    screenShareMessageIdRef.current = screenShareMessageId;
  }, [screenShareMessageId]);

  // Sync isScreenSharing state with service and handle external stops
  useEffect(() => {
    const checkScreenSharing = () => {
      const isSharing = isScreenSharingActive();
      const wasSharing = wasSharingRef.current;
      const currentMessageId = screenShareMessageIdRef.current;

      wasSharingRef.current = isSharing;
      setIsScreenSharing(isSharing);
      onScreenSharingChange?.(isSharing);

      // If screenshare stopped externally (was sharing, now not)
      if (wasSharing && !isSharing && currentMessageId) {
        // Only handle this if we have messages (not during a reset)
        // During reset, messages are cleared, so we don't want to add a "Stopped screenshare" message
        if (messages.length > 0) {
          // Remove the screenshare message
          if (onRemoveMessage) {
            onRemoveMessage(currentMessageId);
          }

          // Add a muted "Stopped screenshare" message
          const stoppedMessage = createSystemMessage(
            'Stopped screenshare',
            'show',
            'user',
            'stopped-sharing'
          );
          onAddMessage(stoppedMessage);
        }

        // Always clear the message ID reference
        setScreenShareMessageId(null);
      }
    };

    // Check initially
    checkScreenSharing();

    // Set up interval to check periodically (in case stream ends externally)
    const interval = setInterval(checkScreenSharing, 1000);

    return () => clearInterval(interval);
  }, [messages.length]);

  const handleSendMessage = () => {
    // Check if there's a pending message (placeholder exists)
    const hasPendingMessage = isLoading || messages.some((msg) => msg.isPlaceholder);

    if (inputValue.trim() && !isLoading && !hasPendingMessage) {
      const messageContent = inputValue.trim();
      setInputValue('');

      // Add user message immediately (like user typed it)
      const userMessage = createUserMessage(messageContent, currentMode);
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
        onSendMessage(messageContent, currentMode, undefined, undefined, true);
      }
    }
  };

  const requestScreenAccess = (mode: InstructionType) => {
    if (screenAccessRequestMessageId) return; // Already requesting

    const screenAccessRequestMessage = createScreenAccessRequestMessage(mode);
    setScreenAccessRequestMessageId(screenAccessRequestMessage.id);

    onAddMessage(screenAccessRequestMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleModeChange = (mode: InstructionType) => {
    // If clicking the same mode, preserve current selection (don't toggle off screen sharing)
    if (mode === currentMode) {
      return;
    }

    // Add system message for mode change
    const modeDisplayNames: Record<InstructionType, string> = {
      show: 'Show',
      tell: 'Tell',
      do: 'Do',
    };

    const systemMessage = createSystemMessage(
      `Switched to ${modeDisplayNames[mode]} mode`,
      mode,
      'agent',
      'mode-change'
    );

    onAddMessage(systemMessage);

    // Change mode without affecting screen sharing
    onSetMode(mode);
  };

  const handleScreenAccessAllow = async () => {
    try {
      // Use screenShareService to start screen sharing
      const stream = await startScreenShare();

      // Permission granted - update UI and proceed
      setIsScreenSharing(true);
      onScreenSharingChange?.(true);

      // Mark the screen access request as handled (but keep it as a screen access request so greeting stays)
      if (screenAccessRequestMessageId) {
        console.log('[ChatWindow] Updating screen access message:', screenAccessRequestMessageId);
        onUpdateMessage(screenAccessRequestMessageId, {
          content: 'Can I take a look at your screen? ✓',
        });
        setScreenAccessRequestMessageId(null);
      } else {
        console.warn('[ChatWindow] No screenAccessRequestMessageId set when trying to update');
      }

      // Add muted "started screenshare" message
      const startedMessage = createStartedScreenshareMessage('show');
      onAddMessage(startedMessage);

      // Create a screenshare message with just the video stream
      const screenshareMessage = createScreenshareMessage(stream, 'show');
      setScreenShareMessageId(screenshareMessage.id);

      // Add screenshare message using the callback
      onAddMessage(screenshareMessage);

      // Send pending message if there is one (only after permission is granted)
      // Pass skipUserMessage based on whether message was already added
      if (pendingMessage) {
        const message = pendingMessage;
        setPendingMessage(null);
        onSendMessage(
          message.content,
          message.mode,
          message.connectionId,
          message.question,
          message.alreadyAdded
        );
      }
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
    // Use screenShareService to stop screen sharing
    stopScreenShare();

    setIsScreenSharing(false);
    onScreenSharingChange?.(false);

    // Remove the screenshare message (the one with video stream)
    if (screenShareMessageId && onRemoveMessage) {
      onRemoveMessage(screenShareMessageId);
    }

    // Add a muted "Stopped screenshare" message
    const stoppedMessage = createSystemMessage(
      'Stopped screenshare',
      'show',
      'user',
      'stopped-sharing'
    );
    onAddMessage(stoppedMessage);

    setScreenShareMessageId(null);
    // Keep the current mode selection - don't change it
  };

  // Get widget settings for positioning
  const effectivePosition = (widgetPosition.position ||
    settings.widget_position ||
    'bottom_right') as 'bottom_left' | 'bottom_right';
  const positionClasses = getPositionClasses(effectivePosition);

  if (!isOpen) return null;

  const customStyles = {
    width: settings.widget_width,
    height: isMinimized ? '48px' : settings.widget_height,
    borderRadius: settings.widget_border_radius,
    fontSize: settings.widget_font_size,
    backgroundColor: '#ffffff',
    backgroundImage: settings.widget_background_color.includes('gradient')
      ? settings.widget_background_color
      : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
    color: settings.widget_text_color,
    borderColor: settings.widget_border_color,
    boxShadow: settings.widget_shadow,
    zIndex: widgetPosition.z_index ?? 40,
  } satisfies React.CSSProperties;

  // Derive scrollbar colors from border color
  const scrollbarTrackColor = addOpacity(settings.widget_border_color, 0.1);
  const scrollbarThumbColor = addOpacity(settings.widget_border_color, 0.3);

  return (
    <div
      className={`fixed rounded-xl ${positionClasses}`}
      style={{
        zIndex: widgetPosition.z_index || 40,
        backgroundColor: '#ffffff',
        backgroundImage: settings.widget_background_color.includes('gradient')
          ? settings.widget_background_color
          : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
      }}
    >
      <div
        className={`
          rounded-lg shadow-xl border
          w-[360px] max-w-sm
          ${isMinimized ? 'h-12' : 'h-[35rem]'} 
          transition-all duration-300 ease-in-out flex flex-col relative overflow-hidden
          ${isOpen ? 'animate-slide-up' : 'animate-slide-down'}
          transform-gpu
          shadow-2xl
        `}
        style={{
          ...customStyles,
          scrollbarColor: `${scrollbarThumbColor} ${scrollbarTrackColor}`,
          scrollbarWidth: 'thin',
        }}
      >
        {/* Header with Marketrix branding */}
        <div
          className='flex justify-between items-center px-3 py-2 relative border-b rounded-t-lg'
          style={{
            backgroundColor: settings.widget_accent_color,
            borderColor: settings.widget_border_color,
          }}
        >
          {/* Left side: Text and live button */}
          <div className='flex items-center gap-2'>
            <span
              className='text-sm font-semibold leading-none'
              style={{ color: getContrastingColor(settings.widget_accent_color) }}
            >
              {settings.widget_header}
            </span>
            {isScreenSharing && (
              <button
                onClick={stopScreenSharing}
                className='flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all shadow-sm hover:opacity-90'
                style={{
                  backgroundColor: settings.widget_secondary_color,
                  color: getContrastingColor(settings.widget_secondary_color),
                }}
                aria-label='Stop screen sharing'
                title='Stop screen sharing'
              >
                <div
                  className='w-2 h-2 rounded-full animate-pulse'
                  style={{ backgroundColor: getContrastingColor(settings.widget_secondary_color) }}
                />
                <span>Live</span>
              </button>
            )}
          </div>

          {/* Right side: Reset and Close buttons */}
          <div
            className='flex items-center space-x-1 rounded-full p-0.5 shadow-sm'
            style={{
              backgroundColor: addOpacity(getContrastingColor(settings.widget_accent_color), 0.1),
            }}
          >
            {onClearChat && (
              <button
                onClick={() => {
                  const result = onClearChat();
                  if (result instanceof Promise) {
                    result.catch((error) => {
                      console.error('Error clearing chat:', error);
                    });
                  }
                }}
                className='p-1 rounded-full transition-colors'
                style={{
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = addOpacity(
                    getContrastingColor(settings.widget_accent_color),
                    0.2
                  );
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label='Reset widget'
                title='Reset widget (clear all stored state)'
              >
                <svg
                  className='w-3 h-3'
                  style={{ color: getContrastingColor(settings.widget_accent_color) }}
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className='p-1 rounded-full transition-colors'
              style={{
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = addOpacity(
                  getContrastingColor(settings.widget_accent_color),
                  0.2
                );
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label='Close chat'
            >
              <svg
                className='w-3 h-3'
                style={{ color: getContrastingColor(settings.widget_accent_color) }}
                fill='currentColor'
                viewBox='0 0 20 20'
              >
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
            <div
              className='flex-shrink-0 rounded-lg m-2'
              style={{
                backgroundColor: '#ffffff',
                backgroundImage: settings.widget_background_color.includes('gradient')
                  ? settings.widget_background_color
                  : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
              }}
            >
              {/* Task Progress Display */}
              {isTaskRunning && taskProgress.length > 0 && (
                <div
                  className='mx-2 mb-2 p-2 rounded text-xs max-h-32 overflow-y-auto'
                  style={{
                    backgroundColor: addOpacity(settings.widget_background_color, 0.8),
                    borderColor: settings.widget_border_color,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                >
                  <div className='font-semibold mb-1' style={{ color: settings.widget_text_color }}>
                    Task Progress ({taskProgress.length} steps)
                  </div>
                  <div className='space-y-1'>
                    {taskProgress.map((progress, idx) => (
                      <div
                        key={idx}
                        className='text-xs opacity-80'
                        style={{ color: settings.widget_text_color }}
                      >
                        <span className='font-medium'>Step {progress.step}:</span>{' '}
                        {progress.tool_name}
                        {progress.tool_params && Object.keys(progress.tool_params).length > 0 && (
                          <span className='opacity-70 ml-1'>
                            ({Object.keys(progress.tool_params).join(', ')})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <MessageInput
                value={inputValue}
                onChange={setInputValue}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                isLoading={isLoading || messages.some((msg) => msg.isPlaceholder)}
                isTaskRunning={isTaskRunning}
                onStop={onStopTask}
                config={config}
              />

              {/* Mode Selector */}
              <ModeSelector
                currentMode={currentMode}
                enabledModes={[
                  ...(settings.widget_feature_show ? ['show' as const] : []),
                  ...(settings.widget_feature_tell ? ['tell' as const] : []),
                  ...(settings.widget_feature_do ? ['do' as const] : []),
                ]}
                onModeChange={handleModeChange}
                isScreenSharing={isScreenSharing}
                config={config}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

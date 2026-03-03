import React, { useEffect, useMemo, useRef, useState } from 'react';

import { type ResizeCorner, useResize } from '../../hooks/useResize';
import { useWidget } from '../../hooks/useWidget';
import type { InstructionType } from '../../sdk';
import {
  createScreenAccessRequestMessage,
  createScreenshareMessage,
  createStartedScreenshareMessage,
  createSystemMessage,
  createUserMessage,
} from '../../services/ChatService';
import {
  isScreenSharing as isScreenSharingActive,
  startScreenShare,
  stopScreenShare,
} from '../../services/ScreenShareService';
import { showModeService } from '../../services/ShowModeService';
import type { ChatMessage, MarketrixConfig, TaskProgress } from '../../types';
import { addOpacity, getContrastingColor } from '../../utils/format';
import { getPositionClasses } from '../../utils/widgetPositioning';
import { Button } from '../base/Button';
import { MessageInput } from '../input/MessageInput';
import { ModeSelector } from '../input/ModeSelector';
import { ScreenAccessModal } from '../ui/ScreenAccessModal';
import { MessageList } from './MessageList';

// Error Boundary for chat messages — defined outside ChatWindow to keep a stable
// class identity across re-renders (avoids unmount/remount of the entire subtree).
class ChatErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chat Error Boundary caught error:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className='p-4 text-center text-xs text-gray-500'>
          Something went wrong displaying messages. Please refresh.
        </div>
      );
    }

    return this.props.children;
  }
}

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
    skipUserMessage?: boolean,
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
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareMessageId, setScreenShareMessageId] = useState<string | null>(null);
  const [screenAccessRequestMessageId, setScreenAccessRequestMessageId] = useState<string | null>(null);
  const [showScreenAccessModal, setShowScreenAccessModal] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    mode?: InstructionType;
    connectionId?: number;
    question?: string;
    alreadyAdded?: boolean;
  } | null>(null);

  const { config: settings, isPreviewMode } = useWidget({ config });

  const tenantId = useMemo(
    () => config.mtxId ?? (config.mtxApp != null ? String(config.mtxApp) : 'default'),
    [config.mtxId, config.mtxApp],
  );
  const { widthPx, heightPx, onResizeStart, containerRef } = useResize(
    settings.widget_width,
    settings.widget_height,
    tenantId,
    isMinimized,
    isPreviewMode,
  );

  // Auto-scroll to bottom when new messages arrive
  // Skip in preview mode to prevent scrolling the parent modal
  useEffect(() => {
    if (messagesEndRef.current) {
      !isPreviewMode && messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isPreviewMode]);

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

  // Stable refs for callbacks so the interval never goes stale
  const onAddMessageRef = useRef(onAddMessage);
  const onRemoveMessageRef = useRef(onRemoveMessage);
  const onScreenSharingChangeRef = useRef(onScreenSharingChange);
  useEffect(() => {
    onAddMessageRef.current = onAddMessage;
  }, [onAddMessage]);
  useEffect(() => {
    onRemoveMessageRef.current = onRemoveMessage;
  }, [onRemoveMessage]);
  useEffect(() => {
    onScreenSharingChangeRef.current = onScreenSharingChange;
  }, [onScreenSharingChange]);

  // Sync isScreenSharing state with service and handle external stops.
  // The interval runs independently; we no longer re-create it on every
  // messages.length change, which avoids a tight re-render / effect loop.
  useEffect(() => {
    const checkScreenSharing = () => {
      const isSharing = isScreenSharingActive();
      const wasSharing = wasSharingRef.current;
      const currentMessageId = screenShareMessageIdRef.current;

      // Only update React state when the value actually changed
      if (isSharing !== wasSharing) {
        wasSharingRef.current = isSharing;
        setIsScreenSharing(isSharing);
        onScreenSharingChangeRef.current?.(isSharing);
      }

      // If screenshare stopped externally (was sharing, now not)
      if (wasSharing && !isSharing && currentMessageId) {
        // Remove the screenshare message
        onRemoveMessageRef.current?.(currentMessageId);

        // Add a muted "Stopped screenshare" message
        const stoppedMessage = createSystemMessage('Stopped screenshare', 'show', 'user', 'stopped-sharing');
        onAddMessageRef.current(stoppedMessage);

        // Always clear the message ID reference
        setScreenShareMessageId(null);
      }
    };

    // Check once on mount
    checkScreenSharing();

    // Set up interval to check periodically (in case stream ends externally)
    const interval = setInterval(checkScreenSharing, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = () => {
    // Check if there's a pending message (placeholder exists)
    const hasPendingMessage = isLoading || messages.some(msg => msg.isPlaceholder);

    if (inputValue.trim() && !isLoading && !hasPendingMessage) {
      const messageContent = inputValue.trim();
      setInputValue('');

      // Add user message immediately (like user typed it)
      const userMessage = createUserMessage(messageContent, currentMode);
      onAddMessage(userMessage);

      // Check if screen sharing is needed for show/do modes
      if (
        config.use_screenshare !== false &&
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
      'mode-change',
    );

    onAddMessage(systemMessage);

    // Change mode without affecting screen sharing
    onSetMode(mode);
  };

  const handleStartScreenShare = () => {
    // Show the screen access modal instead of directly starting screen sharing
    setShowScreenAccessModal(true);
  };

  const handleScreenAccessModalAllow = async () => {
    setShowScreenAccessModal(false);
    try {
      // Use screenShareService to start screen sharing
      const stream = await startScreenShare();

      // Permission granted - update UI and proceed
      setIsScreenSharing(true);
      onScreenSharingChange?.(true);

      // Add muted "started screenshare" message
      const startedMessage = createStartedScreenshareMessage('show');
      onAddMessage(startedMessage);

      // Create a screenshare message with just the video stream
      const screenshareMessage = createScreenshareMessage(stream, 'show');
      setScreenShareMessageId(screenshareMessage.id);

      // Add screenshare message using the callback
      onAddMessage(screenshareMessage);
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      setIsScreenSharing(false);
      onScreenSharingChange?.(false);
    }
  };

  const handleScreenAccessModalDeny = () => {
    setShowScreenAccessModal(false);
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
          screenShareStatus: 'allowed',
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
        onSendMessage(message.content, message.mode, message.connectionId, message.question, message.alreadyAdded);
      }
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      setIsScreenSharing(false);
      onScreenSharingChange?.(false);

      // Permission denied or error - update message and clear pending
      if (screenAccessRequestMessageId) {
        onUpdateMessage(screenAccessRequestMessageId, {
          screenShareStatus: 'denied',
        });
        setScreenAccessRequestMessageId(null);
      }
      // Proceed with pending message anyway (without screen share)
      if (pendingMessage) {
        const message = pendingMessage;
        setPendingMessage(null);
        onSendMessage(message.content, message.mode, message.connectionId, message.question, message.alreadyAdded);
      }
    }
  };

  const handleScreenAccessDeny = () => {
    // Mark the screen access request as handled (but keep it as a screen access request so greeting stays)
    if (screenAccessRequestMessageId) {
      onUpdateMessage(screenAccessRequestMessageId, {
        screenShareStatus: 'denied',
      });
      setScreenAccessRequestMessageId(null);
    }

    // Proceed with pending message if user denies screen access (using HTML only)
    if (pendingMessage) {
      const message = pendingMessage;
      setPendingMessage(null);
      onSendMessage(message.content, message.mode, message.connectionId, message.question, message.alreadyAdded);
    }
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
    const stoppedMessage = createSystemMessage('Stopped screenshare', 'show', 'user', 'stopped-sharing');
    onAddMessage(stoppedMessage);

    setScreenShareMessageId(null);
    // Keep the current mode selection - don't change it
  };

  // Get widget settings for positioning
  const effectivePosition = settings.widget_position as 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right';
  const zIndex = settings.widget_position_z_index ?? 40;
  const positionClasses = getPositionClasses(effectivePosition);

  if (!isOpen) return null;

  const customStyles = {
    width: widthPx,
    height: isMinimized ? '48px' : heightPx,
    borderRadius: settings.widget_border_radius,
    fontSize: settings.widget_font_size,
    backgroundColor: '#ffffff',
    backgroundImage: settings.widget_background_color.includes('gradient')
      ? settings.widget_background_color
      : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
    color: settings.widget_text_color,
    borderColor: settings.widget_border_color,
    boxShadow: settings.widget_shadow,
    zIndex,
  } satisfies React.CSSProperties;

  // Use absolute positioning in preview mode (container-relative), fixed in production (viewport-relative)
  const positionClass = isPreviewMode ? 'absolute' : 'fixed';

  // In preview mode, use inline styles for positioning to ensure it works in shadow DOM
  const previewPositionStyle = isPreviewMode
    ? effectivePosition.includes('top')
      ? {
          top: '20px',
          ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }),
        }
      : {
          bottom: '20px',
          ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }),
        }
    : {};

  return (
    <div
      ref={chatWindowRef}
      className={`${positionClass} rounded-xl ${isPreviewMode ? '' : positionClasses} pointer-events-auto`}
      style={{
        zIndex,
        backgroundColor: '#ffffff',
        backgroundImage: settings.widget_background_color.includes('gradient')
          ? settings.widget_background_color
          : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
        ...previewPositionStyle,
      }}
    >
      <div
        ref={containerRef}
        className={`
          rounded-lg shadow-xl border
          flex flex-col relative overflow-hidden
          ${isOpen ? 'animate-slide-up' : 'animate-slide-down'}
          transform-gpu
          shadow-2xl
        `}
        style={{
          ...customStyles,
          scrollbarColor: `${addOpacity(settings.widget_border_color, 0.3)} ${addOpacity(settings.widget_border_color, 0.1)}`,
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
          {/* Left side: Text and screen sharing buttons */}
          <div className='flex items-center gap-2'>
            <span
              className='text-sm font-semibold leading-none'
              style={{ color: getContrastingColor(settings.widget_accent_color) }}
            >
              {settings.widget_header}
            </span>
            {config.use_screenshare !== false && !isScreenSharing && (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={handleStartScreenShare}
                className='flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 animate-fade-in'
                style={{
                  backgroundColor: settings.widget_secondary_color,
                  color: getContrastingColor(settings.widget_secondary_color),
                  border: 'none',
                }}
                aria-label='Start screen sharing'
                title='Click to start screen sharing'
              >
                <svg
                  className='w-3 h-3'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  style={{
                    color: getContrastingColor(settings.widget_secondary_color),
                  }}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2.5}
                    d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                  />
                </svg>
                <span className='font-medium'>Share Screen</span>
              </Button>
            )}
            {isScreenSharing && (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={stopScreenSharing}
                className='flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 animate-fade-in'
                style={{
                  backgroundColor: settings.widget_secondary_color,
                  color: getContrastingColor(settings.widget_secondary_color),
                  border: 'none',
                }}
                aria-label='Stop screen sharing'
                title='Click to stop screen sharing'
              >
                <div className='relative flex items-center justify-center'>
                  <div
                    className='absolute w-2.5 h-2.5 rounded-full animate-ping opacity-75'
                    style={{
                      backgroundColor: getContrastingColor(settings.widget_secondary_color),
                    }}
                  />
                  <div
                    className='relative w-2 h-2 rounded-full'
                    style={{
                      backgroundColor: getContrastingColor(settings.widget_secondary_color),
                    }}
                  />
                </div>
                <span className='font-medium'>Live</span>
                <svg
                  className='w-3 h-3'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  style={{
                    color: getContrastingColor(settings.widget_secondary_color),
                  }}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2.5}
                    d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                  />
                </svg>
              </Button>
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
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  const result = onClearChat();
                  if (result instanceof Promise) {
                    result.catch(error => {
                      console.error('Error clearing chat:', error);
                    });
                  }
                }}
                className='p-1 rounded-full transition-colors'
                style={{
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = addOpacity(
                    getContrastingColor(settings.widget_accent_color),
                    0.2,
                  );
                }}
                onMouseLeave={e => {
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
              </Button>
            )}
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={onClose}
              className='p-1 rounded-full transition-colors'
              style={{
                backgroundColor: 'transparent',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = addOpacity(
                  getContrastingColor(settings.widget_accent_color),
                  0.2,
                );
              }}
              onMouseLeave={e => {
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
            </Button>
          </div>
        </div>

        {/* Screen Access Modal */}
        {showScreenAccessModal && (
          <ScreenAccessModal
            isOpen={showScreenAccessModal}
            onAllow={handleScreenAccessModalAllow}
            onDeny={handleScreenAccessModalDeny}
            onClose={handleScreenAccessModalDeny}
          />
        )}

        {/* Chat Content */}
        {!isMinimized && (
          <>
            {/* Chat Messages Area */}
            <div className='flex-1 overflow-hidden py-2'>
              <ChatErrorBoundary>
                <MessageList
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  onSendMessage={(content, mode, connectionId, question) => {
                    // Check if screen sharing is needed for show/do modes
                    if (
                      config.use_screenshare !== false &&
                      (mode === 'show' || mode === 'do') &&
                      !isScreenSharing &&
                      !screenAccessRequestMessageId
                    ) {
                      // Store the pending message and show screen access request
                      // alreadyAdded=true because chip messages are already added to chat
                      setPendingMessage({
                        content,
                        mode,
                        ...(connectionId !== undefined ? { connectionId } : {}),
                        ...(question !== undefined ? { question } : {}),
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
              </ChatErrorBoundary>
            </div>

            {/* Controls Section */}
            <div
              className='flex-shrink-0 rounded-lg m-2 mt-auto'
              style={{
                backgroundColor: '#ffffff',
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
                      <div key={idx} className='text-xs opacity-80' style={{ color: settings.widget_text_color }}>
                        <span className='font-medium'>Step {progress.step}:</span> {progress.tool_name}
                        {progress.tool_params && Object.keys(progress.tool_params).length > 0 && (
                          <span className='opacity-70 ml-1'>({Object.keys(progress.tool_params).join(', ')})</span>
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
                isLoading={isLoading || messages.some(msg => msg.isPlaceholder)}
                isTaskRunning={isTaskRunning}
                onStop={() => {
                  // Cleanup show mode popup and highlight when stopping task
                  showModeService.cleanup();
                  onStopTask?.();
                }}
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

        {/* Resize handles - all 4 corners, Windows 11 style */}
        {!isMinimized &&
          !isPreviewMode &&
          (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(corner => {
            const posClasses: Record<ResizeCorner, string> = {
              'top-left': 'top-0 left-0 rounded-tl-lg cursor-nwse-resize items-start justify-start',
              'top-right': 'top-0 right-0 rounded-tr-lg cursor-nesw-resize items-start justify-end',
              'bottom-left': 'bottom-0 left-0 rounded-bl-lg cursor-nesw-resize items-end justify-start',
              'bottom-right': 'bottom-0 right-0 rounded-br-lg cursor-nwse-resize items-end justify-end',
            };
            return (
              <div
                key={corner}
                role='separator'
                aria-label={`Resize widget from ${corner.replace('-', ' ')}`}
                title='Drag to resize'
                className={`absolute w-5 h-5 flex p-1 touch-none z-10 group ${posClasses[corner]}`}
                onMouseDown={onResizeStart(corner)}
              />
            );
          })}
      </div>
    </div>
  );
};

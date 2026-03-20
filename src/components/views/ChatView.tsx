import React, { useEffect, useRef, useState } from 'react';

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
import { addOpacity } from '../../utils/format';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../input/MessageInput';
import { ScreenAccessModal } from '../ui/ScreenAccessModal';

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

export interface ChatViewProps {
  config: MarketrixConfig;
  messages: ChatMessage[];
  currentMode: InstructionType;
  isTaskRunning?: boolean;
  taskProgress?: TaskProgress[];
  onSendMessage: (
    message: string,
    mode?: InstructionType,
    applicationId?: number,
    question?: string,
    skipUserMessage?: boolean,
  ) => void;
  onSetMode: (mode: InstructionType) => void;
  onAddMessage: (message: ChatMessage) => void;
  onUpdateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  onRemoveMessage?: (messageId: string) => void;
  onStopTask?: () => void;
  onClearChat?: () => void | Promise<void>;
  onClose: () => void;
  onScreenSharingChange?: (isSharing: boolean) => void;
  /** Refs for header buttons to trigger screen share start/stop */
  onStartScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  onStopScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  /** Optional ref for focus trap to focus the message input */
  messageInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

function getEnabledModes(
  settings: MarketrixConfig & {
    widget_feature_show?: boolean;
    widget_feature_tell?: boolean;
    widget_feature_do?: boolean;
  },
) {
  return [
    ...(settings.widget_feature_show ? ['show' as const] : []),
    ...(settings.widget_feature_tell ? ['tell' as const] : []),
    ...(settings.widget_feature_do ? ['do' as const] : []),
  ];
}

export const ChatView: React.FC<ChatViewProps> = ({
  config,
  messages,
  currentMode,
  isTaskRunning = false,
  taskProgress = [],
  onSendMessage,
  onSetMode,
  onAddMessage,
  onUpdateMessage,
  onRemoveMessage,
  onStopTask,
  onClearChat: _onClearChat,
  onClose: _onClose,
  onScreenSharingChange,
  onStartScreenShareRef,
  onStopScreenShareRef,
  messageInputRef: externalMessageInputRef,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareMessageId, setScreenShareMessageId] = useState<string | null>(null);
  const [screenAccessRequestMessageId, setScreenAccessRequestMessageId] = useState<string | null>(null);
  const [showScreenAccessModal, setShowScreenAccessModal] = useState(false);

  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    mode?: InstructionType;
    applicationId?: number;
    question?: string;
    alreadyAdded?: boolean;
  } | null>(null);

  const wasSharingRef = useRef(isScreenSharing);
  const screenShareMessageIdRef = useRef(screenShareMessageId);
  const onAddMessageRef = useRef(onAddMessage);
  const onRemoveMessageRef = useRef(onRemoveMessage);
  const onScreenSharingChangeRef = useRef(onScreenSharingChange);

  useEffect(() => {
    wasSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);
  useEffect(() => {
    screenShareMessageIdRef.current = screenShareMessageId;
  }, [screenShareMessageId]);
  useEffect(() => {
    onAddMessageRef.current = onAddMessage;
  }, [onAddMessage]);
  useEffect(() => {
    onRemoveMessageRef.current = onRemoveMessage;
  }, [onRemoveMessage]);
  useEffect(() => {
    onScreenSharingChangeRef.current = onScreenSharingChange;
  }, [onScreenSharingChange]);

  useEffect(() => {
    const checkScreenSharing = () => {
      const isSharing = isScreenSharingActive();
      const wasSharing = wasSharingRef.current;
      const currentMessageId = screenShareMessageIdRef.current;
      if (isSharing !== wasSharing) {
        wasSharingRef.current = isSharing;
        setIsScreenSharing(isSharing);
        onScreenSharingChangeRef.current?.(isSharing);
      }
      if (wasSharing && !isSharing && currentMessageId) {
        onRemoveMessageRef.current?.(currentMessageId);
        const stoppedMessage = createSystemMessage('Stopped screenshare', 'show', 'user', 'stopped-sharing');
        onAddMessageRef.current(stoppedMessage);
        setScreenShareMessageId(null);
      }
    };
    checkScreenSharing();
    const interval = setInterval(checkScreenSharing, 1000);
    return () => clearInterval(interval);
  }, []);

  const requestScreenAccess = (mode: InstructionType) => {
    if (screenAccessRequestMessageId) return;
    const screenAccessRequestMessage = createScreenAccessRequestMessage(mode);
    setScreenAccessRequestMessageId(screenAccessRequestMessage.id);
    onAddMessage(screenAccessRequestMessage);
  };

  const handleSendMessage = () => {
    const hasPendingMessage = messages.some(msg => msg.isPlaceholder);
    if (inputValue.trim() && !hasPendingMessage) {
      const messageContent = inputValue.trim();
      setInputValue('');
      const userMessage = createUserMessage(messageContent, currentMode);
      onAddMessage(userMessage);
      if (
        config.use_screenshare !== false &&
        (currentMode === 'show' || currentMode === 'do') &&
        !isScreenSharing &&
        !screenAccessRequestMessageId
      ) {
        setPendingMessage({ content: messageContent, mode: currentMode, alreadyAdded: true });
        requestScreenAccess(currentMode);
      } else {
        onSendMessage(messageContent, currentMode, undefined, undefined, true);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleModeChange = (mode: InstructionType) => {
    if (mode === currentMode) return;
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
    onSetMode(mode);
  };

  const handleStartScreenShare = () => {
    setShowScreenAccessModal(true);
  };

  const handleScreenAccessModalAllow = async () => {
    setShowScreenAccessModal(false);
    try {
      const stream = await startScreenShare();
      setIsScreenSharing(true);
      onScreenSharingChange?.(true);
      const startedMessage = createStartedScreenshareMessage('show');
      onAddMessage(startedMessage);
      const screenshareMessage = createScreenshareMessage(stream, 'show');
      setScreenShareMessageId(screenshareMessage.id);
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
      const stream = await startScreenShare();
      setIsScreenSharing(true);
      onScreenSharingChange?.(true);
      if (screenAccessRequestMessageId) {
        onUpdateMessage(screenAccessRequestMessageId, { screenShareStatus: 'allowed' });
        setScreenAccessRequestMessageId(null);
      }
      const startedMessage = createStartedScreenshareMessage('show');
      onAddMessage(startedMessage);
      const screenshareMessage = createScreenshareMessage(stream, 'show');
      setScreenShareMessageId(screenshareMessage.id);
      onAddMessage(screenshareMessage);
      if (pendingMessage) {
        const message = pendingMessage;
        setPendingMessage(null);
        onSendMessage(message.content, message.mode, message.applicationId, message.question, message.alreadyAdded);
      }
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      setIsScreenSharing(false);
      onScreenSharingChange?.(false);
      if (screenAccessRequestMessageId) {
        onUpdateMessage(screenAccessRequestMessageId, { screenShareStatus: 'denied' });
        setScreenAccessRequestMessageId(null);
      }
      if (pendingMessage) {
        const message = pendingMessage;
        setPendingMessage(null);
        onSendMessage(message.content, message.mode, message.applicationId, message.question, message.alreadyAdded);
      }
    }
  };

  const handleScreenAccessDeny = () => {
    if (screenAccessRequestMessageId) {
      onUpdateMessage(screenAccessRequestMessageId, { screenShareStatus: 'denied' });
      setScreenAccessRequestMessageId(null);
    }
    if (pendingMessage) {
      const message = pendingMessage;
      setPendingMessage(null);
      onSendMessage(message.content, message.mode, message.applicationId, message.question, message.alreadyAdded);
    }
  };

  const stopScreenSharing = () => {
    stopScreenShare();
    setIsScreenSharing(false);
    onScreenSharingChange?.(false);
    if (screenShareMessageId && onRemoveMessage) {
      onRemoveMessage(screenShareMessageId);
    }
    const stoppedMessage = createSystemMessage('Stopped screenshare', 'show', 'user', 'stopped-sharing');
    onAddMessage(stoppedMessage);
    setScreenShareMessageId(null);
  };

  // Expose screen share handlers to MessengerShell header via refs
  useEffect(() => {
    if (onStartScreenShareRef) onStartScreenShareRef.current = handleStartScreenShare;
    if (onStopScreenShareRef) onStopScreenShareRef.current = stopScreenSharing;
    return () => {
      if (onStartScreenShareRef) onStartScreenShareRef.current = null;
      if (onStopScreenShareRef) onStopScreenShareRef.current = null;
    };
  });

  const settings = config as MarketrixConfig & {
    widget_greeting?: string;
    widget_feature_show?: boolean;
    widget_feature_tell?: boolean;
    widget_feature_do?: boolean;
  };

  return (
    <div className='flex flex-col h-full' id='view-chat' role='tabpanel' aria-labelledby='tab-chat'>
      {showScreenAccessModal && (
        <ScreenAccessModal
          isOpen={showScreenAccessModal}
          onAllow={handleScreenAccessModalAllow}
          onDeny={handleScreenAccessModalDeny}
          onClose={handleScreenAccessModalDeny}
        />
      )}

      <div className='flex-1 overflow-hidden py-1 flex flex-col min-h-0'>
        <ChatErrorBoundary>
          <MessageList
            messages={messages}
            messagesEndRef={messagesEndRef}
            onSendMessage={(content, mode, applicationId, question) => {
              if (
                config.use_screenshare !== false &&
                (mode === 'show' || mode === 'do') &&
                !isScreenSharing &&
                !screenAccessRequestMessageId
              ) {
                setPendingMessage({
                  content,
                  mode,
                  ...(applicationId !== undefined ? { applicationId } : {}),
                  ...(question !== undefined ? { question } : {}),
                  alreadyAdded: true,
                });
                requestScreenAccess(mode || currentMode);
              } else {
                onSendMessage(content, mode, applicationId, question, true);
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

      <div className='flex-shrink-0 rounded-[var(--radius)] m-2 mt-auto' style={{ backgroundColor: '#ffffff' }}>
        {isTaskRunning && taskProgress.length > 0 && (
          <div
            className='mx-2 mb-2 p-2 rounded text-xs max-h-32 overflow-y-auto'
            style={{
              backgroundColor: addOpacity(config.widget_background_color ?? '#fff', 0.8),
              borderColor: config.widget_border_color,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            <div className='font-semibold mb-1' style={{ color: config.widget_text_color }}>
              Task Progress ({taskProgress.length} steps)
            </div>
            <div className='space-y-1'>
              {taskProgress.map((progress, idx) => (
                <div key={idx} className='text-xs opacity-80' style={{ color: config.widget_text_color }}>
                  <span className='font-medium'>Step {progress.step}:</span> {progress.tool_name}
                  {progress.tool_params && Object.keys(progress.tool_params).length > 0 && (
                    <span className='opacity-70 ml-1'>({Object.keys(progress.tool_params).join(', ')})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <MessageInput
          ref={externalMessageInputRef}
          value={inputValue}
          onChange={setInputValue}
          onKeyPress={handleKeyPress}
          onSend={handleSendMessage}
          isLoading={messages.some(msg => msg.isPlaceholder)}
          isTaskRunning={isTaskRunning}
          onStop={() => {
            showModeService.cleanup();
            onStopTask?.();
          }}
          config={config}
          currentMode={currentMode}
          enabledModes={getEnabledModes(settings)}
          onModeChange={handleModeChange}
          isScreenSharing={isScreenSharing}
        />
      </div>
    </div>
  );
};

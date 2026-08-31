import React, { useRef, useState } from 'react';

import { type PendingMessage, useScreenShare } from '../../hooks/useScreenShare';
import type { InstructionType } from '../../sdk';
import { createSystemMessage, createUserMessage } from '../../services/ChatService';
import { showModeService } from '../../services/ShowModeService';
import type { ChatMessage, MarketrixConfig } from '../../types';
import { getModeDisplayName } from '../../utils/color';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ChatInput, type ChatInputMode } from '../blocks/ChatInput';
import { WidgetDialog } from '../blocks/WidgetDialog';
import { MessageList } from '../chat/MessageList';

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
        <Text as='div' size='xs' align='center' style={{ padding: '16px', color: 'var(--muted-foreground)' }}>
          Something went wrong displaying messages. Please refresh.
        </Text>
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
  onSendMessage: (message: string, mode?: InstructionType, skipUserMessage?: boolean) => void;
  onSetMode: (mode: InstructionType) => void;
  onAddMessage: (message: ChatMessage) => void;
  onUpdateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  onRemoveMessage?: (messageId: string) => void;
  onStopTask?: () => void;
  onClearChat?: () => void | Promise<void>;
  onScreenSharingChange?: (isSharing: boolean) => void;
  onStartScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  onStopScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  messageInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

// Display order, and the setting that enables each.
const MODES: Array<{ id: InstructionType; icon: ChatInputMode['icon']; flag: keyof MarketrixConfig }> = [
  { id: 'tell', icon: 'chatBubble', flag: 'widget_feature_tell' },
  { id: 'show', icon: 'mousePointerClick', flag: 'widget_feature_show' },
  { id: 'do', icon: 'ticktick', flag: 'widget_feature_do' },
];

export const ChatView: React.FC<ChatViewProps> = ({
  config,
  messages,
  currentMode,
  isTaskRunning = false,
  onSendMessage,
  onSetMode,
  onAddMessage,
  onUpdateMessage,
  onRemoveMessage,
  onStopTask,
  onClearChat,
  onScreenSharingChange,
  onStartScreenShareRef,
  onStopScreenShareRef,
  messageInputRef: externalMessageInputRef,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null);

  const {
    isScreenSharing,
    showScreenAccessDialog,
    handleScreenAccessDialogAllow,
    handleScreenAccessDialogDeny,
    handleScreenAccessAllow,
    handleScreenAccessDeny,
    requestScreenAccess,
  } = useScreenShare({
    onScreenSharingChange,
    onStartScreenShareRef,
    onStopScreenShareRef,
    onAddMessage,
    onUpdateMessage,
    onRemoveMessage,
    onSendMessage,
    pendingMessage,
    setPendingMessage,
  });

  const handleSendMessage = () => {
    const hasPendingMessage = messages.some(msg => msg.isPlaceholder);
    if (inputValue.trim() && !hasPendingMessage) {
      const messageContent = inputValue.trim();
      setInputValue('');
      const userMessage = createUserMessage(messageContent, currentMode);
      onAddMessage(userMessage);
      if (config.use_screenshare !== false && (currentMode === 'show' || currentMode === 'do') && !isScreenSharing) {
        setPendingMessage({ content: messageContent, mode: currentMode, alreadyAdded: true });
        requestScreenAccess(currentMode);
      } else {
        onSendMessage(messageContent, currentMode, true);
      }
    }
  };

  const handleModeChange = (mode: InstructionType) => {
    if (mode === currentMode) return;
    onAddMessage(createSystemMessage(`Switched to ${getModeDisplayName(mode)} mode`, mode, 'agent', 'mode-change'));
    onSetMode(mode);
  };

  return (
    <Stack height='full' id='view-chat' role='tabpanel' aria-labelledby='tab-chat'>
      {showScreenAccessDialog && (
        <WidgetDialog
          open={showScreenAccessDialog}
          onClose={handleScreenAccessDialogDeny}
          title='Can I take a look at your screen?'
          description='By allowing screen access, Marketrix can understand your current context to guide you better and complete tasks on your behalf.'
          onConfirm={handleScreenAccessDialogAllow}
          confirmLabel='Yes'
          cancelLabel='No'
        />
      )}

      <Surface grow overflow='hidden' paddingY='xs' style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ChatErrorBoundary>
          <MessageList
            messages={messages}
            messagesEndRef={messagesEndRef}
            config={config}
            onScreenAccessAllow={handleScreenAccessAllow}
            onScreenAccessDeny={handleScreenAccessDeny}
            onClearChat={onClearChat}
          />
        </ChatErrorBoundary>
      </Surface>

      <Surface
        background='card'
        border
        elevation='card'
        paddingPreset='card'
        radius='xl'
        style={{ margin: '0 12px 12px 12px', marginTop: 'auto' }}
      >
        <ChatInput
          ref={externalMessageInputRef}
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSendMessage}
          modes={MODES.filter(({ flag }) => config[flag]).map(({ id, icon }) => ({
            id,
            icon,
            label: getModeDisplayName(id),
          }))}
          activeMode={currentMode}
          onModeChange={mode => handleModeChange(mode as InstructionType)}
          disabled={messages.some(msg => msg.isPlaceholder)}
          taskRunning={isTaskRunning}
          onStop={() => {
            showModeService.cleanup();
            onStopTask?.();
          }}
        />
      </Surface>
    </Stack>
  );
};

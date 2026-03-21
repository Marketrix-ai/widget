import React, { useRef, useState } from 'react';

import { type PendingMessage, useScreenShare } from '../../hooks/useScreenShare';
import type { InstructionType } from '../../sdk';
import { createSystemMessage, createUserMessage } from '../../services/ChatService';
import { showModeService } from '../../services/ShowModeService';
import type { ChatMessage, MarketrixConfig, TaskProgress } from '../../types';
import { addOpacity, getModeDisplayName } from '../../utils/format';
import { Card } from '../base/Card';
import { Flex } from '../base/Flex';
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
  onScreenSharingChange?: (isSharing: boolean) => void;
  /** Refs for header buttons to trigger screen share start/stop */
  onStartScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  onStopScreenShareRef?: React.MutableRefObject<(() => void) | null>;
  /** Optional ref for focus trap to focus the message input */
  messageInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const MODE_ICON_MAP: Record<InstructionType, ChatInputMode['icon']> = {
  show: 'mousePointerClick',
  tell: 'chatBubble',
  do: 'ticktick',
};

const ORDERED_MODES: InstructionType[] = ['tell', 'show', 'do'];

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
        onSendMessage(messageContent, currentMode, undefined, undefined, true);
      }
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

  const settings = config as MarketrixConfig & {
    widget_greeting?: string;
    widget_feature_show?: boolean;
    widget_feature_tell?: boolean;
    widget_feature_do?: boolean;
  };

  return (
    <Stack height='full' id='view-chat' role='tabpanel' aria-labelledby='tab-chat'>
      {showScreenAccessDialog && (
        <WidgetDialog
          variant='confirm'
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

      <Card style={{ margin: '0 12px 12px 12px', marginTop: 'auto' }}>
        {isTaskRunning && taskProgress.length > 0 && (
          <Surface
            rounded
            overflowY='auto'
            style={{
              margin: '0 8px 8px',
              padding: '8px',
              maxHeight: '128px',
              backgroundColor: addOpacity(config.widget_background_color ?? '#fff', 0.8),
              borderColor: config.widget_border_color,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            <Text as='div' weight='semibold' style={{ marginBottom: '4px', color: config.widget_text_color }}>
              Task Progress ({taskProgress.length} steps)
            </Text>
            <Stack gap='xs'>
              {taskProgress.map((progress, idx) => (
                <Flex
                  key={idx}
                  align='start'
                  gap='sm'
                  style={{ fontSize: '12px', opacity: 0.8, color: config.widget_text_color }}
                >
                  <Text as='span' weight='medium'>
                    Step {progress.step}:
                  </Text>{' '}
                  {progress.tool_name}
                  {progress.tool_params && Object.keys(progress.tool_params).length > 0 && (
                    <Text as='span' style={{ opacity: 0.7, marginLeft: '4px' }}>
                      ({Object.keys(progress.tool_params).join(', ')})
                    </Text>
                  )}
                </Flex>
              ))}
            </Stack>
          </Surface>
        )}

        <ChatInput
          ref={externalMessageInputRef}
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSendMessage}
          modes={ORDERED_MODES.filter(m => getEnabledModes(settings).includes(m)).map(m => ({
            id: m,
            icon: MODE_ICON_MAP[m],
            label: getModeDisplayName(m),
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
      </Card>
    </Stack>
  );
};

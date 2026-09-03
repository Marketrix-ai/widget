import React, { useRef, useState } from 'react';

import { type PendingMessage, useScreenShare } from '../../hooks/useScreenShare';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { InstructionType } from '../../sdk';
import { createSystemMessage, createUserMessage } from '../../services/ChatService';
import { showModeService } from '../../services/ShowModeService';
import type { MarketrixConfig } from '../../types';
import { getModeDisplayName } from '../../utils/chat';
import { ErrorBoundary } from '../base/ErrorBoundary';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ChatInput, type ChatInputMode } from '../blocks/ChatInput';
import { WidgetDialog } from '../blocks/WidgetDialog';
import { MessageList } from '../chat/MessageList';

interface ChatViewProps {
  onScreenSharingChange: (isSharing: boolean) => void;
  onStartScreenShareRef: React.MutableRefObject<(() => void) | null>;
  onStopScreenShareRef: React.MutableRefObject<(() => void) | null>;
  messageInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

// Display order, and the setting that enables each.
const MODES: Array<{ id: InstructionType; icon: ChatInputMode['icon']; flag: keyof MarketrixConfig }> = [
  { id: 'tell', icon: 'chatBubble', flag: 'widget_feature_tell' },
  { id: 'show', icon: 'mousePointerClick', flag: 'widget_feature_show' },
  { id: 'do', icon: 'ticktick', flag: 'widget_feature_do' },
];

export const ChatView: React.FC<ChatViewProps> = ({
  onScreenSharingChange,
  onStartScreenShareRef,
  onStopScreenShareRef,
  messageInputRef,
}) => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { messages, currentMode, isTaskRunning } = state;

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
    onAddMessage: actions.addMessage,
    onUpdateMessage: actions.updateMessage,
    onRemoveMessage: actions.removeMessage,
    onSendMessage: actions.messageDispatch,
    pendingMessage,
    setPendingMessage,
  });

  const handleSendMessage = () => {
    const hasPendingMessage = messages.some(msg => msg.isPlaceholder);
    if (inputValue.trim() && !hasPendingMessage) {
      const messageContent = inputValue.trim();
      setInputValue('');
      actions.addMessage(createUserMessage(messageContent, currentMode));
      if (config.use_screenshare !== false && (currentMode === 'show' || currentMode === 'do') && !isScreenSharing) {
        setPendingMessage({ content: messageContent, mode: currentMode, alreadyAdded: true });
        requestScreenAccess(currentMode);
      } else {
        void actions.messageDispatch(messageContent, currentMode, true);
      }
    }
  };

  const handleModeChange = (mode: InstructionType) => {
    if (mode === currentMode) return;
    actions.addMessage(
      createSystemMessage(`Switched to ${getModeDisplayName(mode)} mode`, mode, 'agent', 'mode-change'),
    );
    actions.setMode(mode);
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
        <ErrorBoundary
          label='Chat'
          fallback={
            <Text as='div' size='xs' align='center' style={{ padding: '16px', color: 'var(--muted-foreground)' }}>
              Something went wrong displaying messages. Please refresh.
            </Text>
          }
        >
          <MessageList
            messagesEndRef={messagesEndRef}
            onScreenAccessAllow={handleScreenAccessAllow}
            onScreenAccessDeny={handleScreenAccessDeny}
          />
        </ErrorBoundary>
      </Surface>

      <Surface
        background='card'
        border
        elevation='card'
        paddingPreset='card'
        rounded='xl'
        style={{ margin: '0 12px 12px 12px', marginTop: 'auto' }}
      >
        <ChatInput
          ref={messageInputRef}
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
            void actions.stopTask();
          }}
        />
      </Surface>
    </Stack>
  );
};

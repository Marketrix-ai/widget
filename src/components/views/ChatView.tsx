/**
 * The messenger panel's chat view: the scrolling transcript, the composer, and the screen-access
 * dialog that gates Show/Do.
 *
 * `ChatViewProps` are the shell's three wires — a screen-sharing flag lifted to the header, a ref the
 * shell's toolbar button fills with a share toggle, and the composer textarea ref. `MODES` pairs the
 * mode chips' display order with the tenant setting enabling each, so the composer offers only what
 * the workspace turned on. `ChatView` owns the draft text; `handleSendMessage` posts the turn and
 * `handleModeChange` announces a mode switch in the transcript before flipping state.
 *
 * The composer is locked both while a reply is outstanding and while a screen-access request is open,
 * since a second turn queued behind an unanswered permission card has nowhere to land. `use_screenshare`
 * absent means enabled; only an explicit `false` skips the ask — Show and Do request screen access first
 * unless a share is already live, and `useScreenShare` flushes the held turn on every outcome. This view
 * writes the user's bubble itself, so every dispatch from here is `skipUserMessage`. Stop tears down
 * `showModeService` before `stopTask`, since an in-flight highlight owns listeners, a watchdog and
 * injected nodes that outlive the task otherwise. `WidgetDialog` gets an explicit `finalFocusRef`
 * since Base UI's focus restore resolves to the host page inside a closed shadow root otherwise. The
 * transcript sits under its own `ErrorBoundary` so one unrenderable message can't take the composer down.
 */
import React, { useRef, useState } from 'react';

import { useScreenShare } from '../../hooks/useScreenShare';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { InstructionType } from '../../sdk';
import { showModeService } from '../../services/ShowModeService';
import type { MarketrixConfig } from '../../types';
import { createSystemMessage, createUserMessage, getModeDisplayName } from '../../utils/chat';
import { ErrorBoundary } from '../base/ErrorBoundary';
import { Stack } from '../base/Flex';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ChatInput, type ChatInputMode } from '../blocks/ChatInput';
import { WidgetDialog } from '../blocks/WidgetDialog';
import { MessageList } from '../chat/MessageList';

interface ChatViewProps {
  onScreenSharingChange: (isSharing: boolean) => void;
  toggleScreenShareRef: React.MutableRefObject<(() => void) | null>;
  messageInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

const MODES: Array<{ id: InstructionType; icon: ChatInputMode['icon']; flag: keyof MarketrixConfig }> = [
  { id: 'tell', icon: 'chatBubble', flag: 'widget_feature_tell' },
  { id: 'show', icon: 'mousePointerClick', flag: 'widget_feature_show' },
  { id: 'do', icon: 'ticktick', flag: 'widget_feature_do' },
];

export const ChatView: React.FC<ChatViewProps> = ({ onScreenSharingChange, toggleScreenShareRef, messageInputRef }) => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { currentMode, isTaskRunning, isAwaitingReply } = state;

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isScreenSharing,
    isAwaitingScreenAccess,
    showScreenAccessDialog,
    handleScreenAccessDialogAllow,
    handleScreenAccessDialogDismiss,
    handleScreenAccessRequestAllow,
    handleScreenAccessRequestDeny,
    requestScreenAccess,
  } = useScreenShare({
    onScreenSharingChange,
    toggleScreenShareRef,
    onAddMessage: actions.addMessage,
    onUpdateMessage: actions.updateMessage,
    onRemoveMessage: actions.removeMessage,
    onSendMessage: actions.messageDispatch,
    messages: state.messages,
  });

  const composerLocked = isAwaitingScreenAccess || isAwaitingReply;

  const handleSendMessage = () => {
    if (!inputValue.trim() || composerLocked) return;
    const messageContent = inputValue.trim();
    setInputValue('');
    actions.addMessage(createUserMessage(messageContent, currentMode));
    if (config.use_screenshare !== false && (currentMode === 'show' || currentMode === 'do') && !isScreenSharing) {
      requestScreenAccess(currentMode, messageContent);
    } else {
      void actions.messageDispatch(messageContent, currentMode, true);
    }
  };

  const handleModeChange = (mode: InstructionType) => {
    if (mode === currentMode) return;
    actions.addMessage(createSystemMessage(`Switched to ${getModeDisplayName(mode)} mode`, 'mode-change'));
    actions.setMode(mode);
  };

  return (
    <Stack height='full'>
      {showScreenAccessDialog && (
        <WidgetDialog
          open={showScreenAccessDialog}
          onClose={handleScreenAccessDialogDismiss}
          title='Can I take a look at your screen?'
          description='By allowing screen access, Marketrix can understand your current context to guide you better and complete tasks on your behalf.'
          onConfirm={handleScreenAccessDialogAllow}
          confirmLabel='Yes'
          cancelLabel='No'
          finalFocusRef={messageInputRef}
        />
      )}

      <Surface grow overflow='hidden' paddingY='2xs' style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ErrorBoundary
          label='Chat'
          fallback={
            <Text as='div' size='xs' align='center' variant='muted' style={{ padding: '16px' }}>
              Something went wrong displaying messages. Please refresh.
            </Text>
          }
        >
          <MessageList
            messagesEndRef={messagesEndRef}
            onScreenAccessAllow={handleScreenAccessRequestAllow}
            onScreenAccessDeny={handleScreenAccessRequestDeny}
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
          onModeChange={handleModeChange}
          disabled={composerLocked}
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

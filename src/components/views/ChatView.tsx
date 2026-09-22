/**
 * The messenger panel's chat view: the scrolling transcript and the composer.
 *
 * `ChatView` owns the draft text and sends each turn through the store's `sendTurn`, restoring the draft
 * to the composer if sending fails. The composer stays locked while a reply is pending or a screen-access
 * request is waiting for an answer, so no later send can overwrite the held turn.
 */
import React, { useRef, useState } from 'react';

import { openScreenAccessRequest } from '../../context/chatReducer';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { InstructionType } from '../../sdk';
import { showModeService } from '../../services/ShowModeService';
import { createSystemMessage, MODE_LABELS } from '../../utils/chat';
import { ErrorBoundary } from '../base/ErrorBoundary';
import { Stack } from '../base/Flex';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ChatInput, type ChatInputMode } from '../blocks/ChatInput';
import { MessageList } from '../chat/MessageList';

const MODES: Array<{
  id: InstructionType;
  icon: ChatInputMode['icon'];
  flag: 'widget_feature_tell' | 'widget_feature_show' | 'widget_feature_do';
}> = [
  { id: 'tell', icon: 'chatBubble', flag: 'widget_feature_tell' },
  { id: 'show', icon: 'mousePointerClick', flag: 'widget_feature_show' },
  { id: 'do', icon: 'ticktick', flag: 'widget_feature_do' },
];

export const ChatView: React.FC<{ messageInputRef: React.RefObject<HTMLTextAreaElement | null> }> = ({
  messageInputRef,
}) => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { currentMode, isTaskRunning, isAwaitingReply, messages } = state;

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const composerLocked = !!openScreenAccessRequest(messages) || isAwaitingReply;

  const handleSendMessage = () => {
    const messageContent = inputValue.trim();
    if (!messageContent || composerLocked) return;
    setInputValue('');
    void actions.sendTurn(messageContent, currentMode).then(sent => {
      if (!sent) setInputValue(current => current || messageContent);
    });
  };

  const handleModeChange = (mode: InstructionType) => {
    if (mode === currentMode) return;
    actions.addMessage(createSystemMessage(`Switched to ${MODE_LABELS[mode]} mode`));
    actions.setMode(mode);
  };

  return (
    <Stack height='full'>
      <Stack grow overflow='hidden' paddingY='2xs' minHeight='0'>
        <ErrorBoundary
          label='Chat'
          fallback={
            <Text as='div' size='xs' align='center' variant='muted' style={{ padding: '16px' }}>
              Something went wrong displaying messages. Please refresh.
            </Text>
          }
        >
          <MessageList messagesEndRef={messagesEndRef} />
        </ErrorBoundary>
      </Stack>

      <Surface variant='floatingCard' style={{ marginTop: 'auto' }}>
        <ChatInput
          ref={messageInputRef}
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSendMessage}
          modes={MODES.filter(({ flag }) => config[flag]).map(({ id, icon }) => ({ id, icon, label: MODE_LABELS[id] }))}
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

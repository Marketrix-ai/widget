/**
 * The messenger panel's chat view: the scrolling transcript and the composer.
 *
 * `ChatView` owns the draft text and sends each turn through the store's `sendTurn`, restoring the draft
 * to the composer if sending fails. The composer stays locked while a reply is pending, a screen-access
 * request is waiting for an answer, or the tenant enabled no mode at all.
 */
import React, { useState } from 'react';

import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import type { InstructionType } from '../../types';
import { enabledModes, MODE_LABELS } from '../../utils/chat';
import { ErrorBoundary } from '../base/ErrorBoundary';
import { Stack } from '../base/Flex';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ChatInput, type ChatInputMode } from '../blocks/ChatInput';
import { MessageList } from '../chat/MessageList';

const MODE_ICONS: Record<InstructionType, ChatInputMode['icon']> = {
  tell: 'chatBubble',
  show: 'mousePointerClick',
  do: 'checkArc',
};

export const ChatView: React.FC<{ messageInputRef: React.RefObject<HTMLTextAreaElement | null> }> = ({
  messageInputRef,
}) => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { currentMode, isTaskRunning, isComposerLocked } = state;
  const modes = enabledModes(config);

  const [inputValue, setInputValue] = useState('');

  const composerLocked = isComposerLocked || modes.length === 0;

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
    actions.addSystemMessage(`Switched to ${MODE_LABELS[mode]} mode`);
    actions.setMode(mode);
  };

  return (
    <Stack height='full'>
      <Stack grow overflow='hidden' paddingY='2xs' minHeight='0'>
        <ErrorBoundary
          label='Chat'
          fallback={
            <Text as='div' size='xs' align='center' variant='muted' style={{ padding: '16px' }}>
              Something went wrong displaying messages. Please refresh the page.
            </Text>
          }
        >
          <MessageList />
        </ErrorBoundary>
      </Stack>

      <Surface floatingCard style={{ marginTop: 'auto' }}>
        <ChatInput
          ref={messageInputRef}
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSendMessage}
          modes={modes.map(id => ({ id, icon: MODE_ICONS[id], label: MODE_LABELS[id] }))}
          activeMode={currentMode}
          onModeChange={handleModeChange}
          disabled={composerLocked}
          taskRunning={isTaskRunning}
          onStop={actions.stopTask}
        />
      </Surface>
    </Stack>
  );
};

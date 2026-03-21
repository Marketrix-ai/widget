import React from 'react';

import type { InstructionType } from '../../sdk';
import { getModeDisplayName } from '../../utils/format';
import { Surface } from '../base/Surface';
import { ChatInput, type ChatInputMode } from '../blocks/ChatInput';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isLoading: boolean;
  isTaskRunning?: boolean;
  onStop?: () => void;
  currentMode?: InstructionType;
  enabledModes?: InstructionType[];
  onModeChange?: (mode: InstructionType) => void;
  isScreenSharing?: boolean;
}

const MODE_ICON_MAP: Record<InstructionType, ChatInputMode['icon']> = {
  show: 'mousePointerClick',
  tell: 'chatBubble',
  do: 'ticktick',
};

const ORDERED_MODES: InstructionType[] = ['tell', 'show', 'do'];

export const MessageInput = React.forwardRef<HTMLTextAreaElement, Omit<MessageInputProps, 'ref'>>(function MessageInput(
  { value, onChange, onSend, isLoading, isTaskRunning = false, onStop, currentMode, enabledModes = [], onModeChange },
  ref,
) {
  const modes: ChatInputMode[] = ORDERED_MODES.filter(m => enabledModes.includes(m)).map(m => ({
    id: m,
    icon: MODE_ICON_MAP[m],
    label: getModeDisplayName(m),
  }));

  return (
    <Surface paddingY='sm' paddingX='md' style={{ backgroundColor: 'transparent' }}>
      <ChatInput
        ref={ref}
        value={value}
        onChange={onChange}
        onSubmit={onSend}
        modes={modes}
        activeMode={currentMode}
        onModeChange={mode => onModeChange?.(mode as InstructionType)}
        disabled={isLoading}
        taskRunning={isTaskRunning}
        onStop={onStop}
        placeholder='Ask anything'
      />
    </Surface>
  );
});

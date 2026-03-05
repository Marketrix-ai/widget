import React from 'react';

import { useWidgetContext } from '../../context/WidgetContext';
import type { ChatMessage, InstructionType, MarketrixConfig, TaskProgress } from '../../types';
import { MessengerShell } from '../navigation/MessengerShell';

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

/**
 * Thin wrapper around MessengerShell for backward compatibility.
 * MarketrixWidget uses MessengerShell directly; this component delegates to it
 * with the same props plus activeView/setActiveView from context.
 */
export const ChatWindow: React.FC<ChatWindowProps> = props => {
  const { state, actions } = useWidgetContext();
  return (
    <MessengerShell
      config={props.config}
      isOpen={props.isOpen}
      isMinimized={props.isMinimized}
      messages={props.messages}
      currentMode={props.currentMode}
      isTaskRunning={props.isTaskRunning}
      taskProgress={props.taskProgress}
      activeView={state.activeView}
      onClose={props.onClose}
      onSendMessage={props.onSendMessage}
      onSetMode={props.onSetMode}
      onAddMessage={props.onAddMessage}
      onUpdateMessage={props.onUpdateMessage}
      onRemoveMessage={props.onRemoveMessage}
      onStopTask={props.onStopTask}
      onClearChat={props.onClearChat}
      onScreenSharingChange={props.onScreenSharingChange}
      setActiveView={actions.setActiveView}
    />
  );
};

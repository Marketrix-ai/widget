/**
 * The two context hooks every widget component reads: `useWidgetConfig` for settings, `useWidget` for the store.
 *
 * `WidgetConfigContext` publishes every setting resolved — API settings plus the position and z-index `WidgetRoot`
 * layers on top — and `useWidgetConfig` reads it, throwing outside `WidgetRoot` rather than defaulting, so nothing
 * below ever touches the raw config prop or threads it down as props. `useWidget` folds the two independent stores
 * (`UIStateContext`, `ChatContext`) into one memoized `{state, actions}`: `isTaskRunning` reads the canonical *wire*
 * status `'running'`, never the UI-only `ChatMessage.taskStatus` vocabulary, and `isAwaitingReply` the placeholder
 * message held open while a reply streams. `clearChatHistory` resets messages, task and the UI error together — an
 * error left standing would outlive the chat it described.
 */

import { createContext, useContext, useMemo } from 'react';

import { useChatContext } from '../context/ChatContext';
import { useUIStateContext } from '../context/UIStateContext';
import type { ValidWidgetConfig, WidgetState } from '../types';

export const WidgetConfigContext = createContext<ValidWidgetConfig | null>(null);

export const useWidgetConfig = (): ValidWidgetConfig => {
  const config = useContext(WidgetConfigContext);
  if (!config) throw new Error('useWidgetConfig must be used within WidgetRoot');
  return config;
};

export const useWidget = () => {
  const { uiState, uiActions } = useUIStateContext();
  const { messages, chatActions, taskState, taskActions } = useChatContext();

  const state = useMemo<WidgetState>(
    () => ({
      ...uiState,
      messages,
      isTaskRunning: taskState.phase === 'running',
      isAwaitingReply: messages.some(msg => msg.isPlaceholder),
    }),
    [uiState, messages, taskState],
  );

  const actions = useMemo(
    () => ({
      ...uiActions,
      ...taskActions,
      ...chatActions,
      clearChatHistory: () => {
        chatActions.clearMessages();
        taskActions.resetTask();
        uiActions.setError(undefined);
      },
    }),
    [uiActions, taskActions, chatActions],
  );

  return { state, actions };
};

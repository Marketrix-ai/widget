import { useEffect } from 'react';

import type { WidgetState } from '../types';
import { findTaskMessageIndex, updateThinkingMarker } from '../utils/chat';

/**
 * Hook for managing task state and placeholder updates
 */
export function useTaskState(
  state: WidgetState,
  setState: React.Dispatch<React.SetStateAction<WidgetState>>
) {
  useEffect(() => {
    setState((prev) => {
      const messages = [...prev.messages];
      let updated = false;

      // Find placeholder messages and update their state
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.isPlaceholder && msg.sender === 'agent' && !msg.isSystemMessage) {
          // Determine placeholder state based on:
          // - 'waiting-for-user': task is running in show/do mode and has progress lines
          // - 'thinking': otherwise (agent is processing)
          const hasProgress = msg.parts?.some((p) => p.type === 'progress') ?? false;
          const shouldBeWaitingForUser =
            prev.isTaskRunning &&
            (prev.currentMode === 'show' || prev.currentMode === 'do') &&
            hasProgress;

          const newState: 'thinking' | 'waiting-for-user' = shouldBeWaitingForUser
            ? 'waiting-for-user'
            : 'thinking';

          if (msg.placeholderState !== newState) {
            messages[i] = {
              ...msg,
              placeholderState: newState,
            };
            updated = true;
          }
        }
      }

      // Also handle non-placeholder messages with thinking markers
      if (!prev.isTaskRunning || (prev.currentMode !== 'show' && prev.currentMode !== 'do')) {
        // Remove thinking indicator if task is not running or not in show/do mode
        const hasThinkingMessages = messages.some(
          (msg) =>
            msg.sender === 'agent' &&
            !msg.isSystemMessage &&
            !msg.isScreenAccessRequest &&
            !msg.isPlaceholder &&
            msg.content.includes('__THINKING__')
        );
        if (hasThinkingMessages) {
          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (
              msg.sender === 'agent' &&
              !msg.isSystemMessage &&
              !msg.isScreenAccessRequest &&
              !msg.isPlaceholder &&
              msg.content.includes('__THINKING__')
            ) {
              messages[i] = {
                ...msg,
                content: msg.content.replace(/\n\n__THINKING__$/, ''),
              };
              updated = true;
            }
          }
        }
      } else {
        // Find the last agent message (task message) and update thinking marker
        const taskMessageIndex = findTaskMessageIndex(messages);

        if (taskMessageIndex >= 0) {
          const taskMessage = messages[taskMessageIndex];
          const updatedMessage = updateThinkingMarker(
            taskMessage,
            prev.isTaskRunning,
            prev.currentMode
          );

          if (updatedMessage !== taskMessage) {
            messages[taskMessageIndex] = updatedMessage;
            updated = true;
          }
        }
      }

      return updated ? { ...prev, messages } : prev;
    });
  }, [state.isTaskRunning, state.currentMode, state.messages, setState]);
}

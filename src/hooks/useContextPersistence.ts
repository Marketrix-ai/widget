/**
 * Context Persistence Hook
 *
 * Handles auto-saving chat context to localStorage when state changes.
 * Uses simplified decision logic and debouncing for optimal performance.
 */

import { useEffect, useRef } from 'react';

import { getDebounceTime, shouldSaveState } from '../services/saveDecisionService';
import type { WidgetState } from '../types';
import { storeChatContext } from '../utils/chatStorage';
import { initializationState } from '../utils/initializationState';
import { createLogger } from '../utils/logger';
import { createStateSnapshot, type StateSnapshot } from '../utils/stateComparisonUtils';

const log = createLogger('ContextPersistence');

/**
 * Hook for managing context persistence
 */
export function useContextPersistence(
  state: WidgetState,
  isRestoring: React.MutableRefObject<boolean>
) {
  // Track previous state for comparison
  const previousStateRef = useRef<WidgetState>(state);
  const previousMessagesRef = useRef<WidgetState['messages']>(state.messages);
  const lastSavedRef = useRef<StateSnapshot | null>(null);

  useEffect(() => {
    const chatId = initializationState.getChatId();
    if (!chatId || !initializationState.getComplete()) {
      return;
    }

    // Skip saves during context restoration
    if (isRestoring.current) {
      return;
    }

    // Get save decision
    const decision = shouldSaveState(
      state,
      previousStateRef.current,
      previousMessagesRef.current,
      lastSavedRef.current
    );

    // Update refs for next comparison
    previousStateRef.current = state;
    previousMessagesRef.current = state.messages;

    if (!decision.shouldSave) {
      return;
    }

    // Handle immediate save
    if (decision.shouldSaveImmediately) {
      const snapshot = createStateSnapshot(state);
      storeChatContext(
        chatId,
        state.messages,
        state.isTaskRunning,
        state.activeTaskId,
        state.taskProgress,
        state.currentMode,
        state.isOpen,
        state.isMinimized
      );
      lastSavedRef.current = snapshot;

      log.debug('Immediate save:', {
        reason: decision.reason,
        isTaskRunning: state.isTaskRunning,
        messageCount: state.messages.length,
        taskProgressLength: state.taskProgress.length,
      });
      return;
    }

    // Handle debounced save
    const debounceMs = getDebounceTime(state);
    const timeoutId = setTimeout(() => {
      const snapshot = createStateSnapshot(state);
      storeChatContext(
        chatId,
        state.messages,
        state.isTaskRunning,
        state.activeTaskId,
        state.taskProgress,
        state.currentMode,
        state.isOpen,
        state.isMinimized
      );
      lastSavedRef.current = snapshot;
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [
    state.messages,
    state.isTaskRunning,
    state.activeTaskId,
    state.taskProgress,
    state.currentMode,
    state.isOpen,
    state.isMinimized,
    isRestoring,
  ]);
}

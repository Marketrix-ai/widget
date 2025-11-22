/**
 * State Comparison Utilities
 *
 * Utilities for detecting state changes without maintaining multiple refs.
 * Simplifies change detection logic for persistence and state updates.
 */

import type { ChatMessage, WidgetState } from '../types';

export interface StateSnapshot {
  isOpen: boolean;
  isMinimized: boolean;
  messageCount: number;
  isTaskRunning: boolean;
  activeTaskId: string | null;
  taskProgressLength: number;
  taskProgressHash: string;
}

/**
 * Create a snapshot of state for comparison
 */
export function createStateSnapshot(state: WidgetState): StateSnapshot {
  return {
    isOpen: state.isOpen,
    isMinimized: state.isMinimized,
    messageCount: state.messages.length,
    isTaskRunning: state.isTaskRunning,
    activeTaskId: state.activeTaskId,
    taskProgressLength: state.taskProgress.length,
    taskProgressHash: JSON.stringify(state.taskProgress),
  };
}

/**
 * Check if messages actually changed (not just length, but content)
 */
export function messagesChanged(current: ChatMessage[], previous: ChatMessage[]): boolean {
  if (current.length !== previous.length) {
    return true;
  }

  return current.some((msg, idx) => {
    const prevMsg = previous[idx];
    return !prevMsg || msg.id !== prevMsg.id || msg.content !== prevMsg.content;
  });
}

/**
 * Check if new messages were added
 */
export function newMessagesAdded(current: ChatMessage[], previous: ChatMessage[]): boolean {
  return current.length > previous.length && messagesChanged(current, previous);
}

/**
 * Check if UI state changed
 */
export function uiStateChanged(current: WidgetState, snapshot: StateSnapshot | null): boolean {
  if (!snapshot) {
    return true;
  }

  return snapshot.isOpen !== current.isOpen || snapshot.isMinimized !== current.isMinimized;
}

/**
 * Check if task progress changed
 */
export function taskProgressChanged(current: WidgetState, snapshot: StateSnapshot | null): boolean {
  const hasProgress = current.taskProgress.length > 0;
  const hadProgress = snapshot ? snapshot.taskProgressLength > 0 : false;
  const currentHash = JSON.stringify(current.taskProgress);

  return (
    (!snapshot && hasProgress) || // First save with progress
    (hasProgress && snapshot?.taskProgressHash !== currentHash) || // Progress changed
    (hadProgress && !hasProgress) // Progress cleared (task completed)
  );
}

/**
 * Check if critical state changed (messages, task state, etc.)
 */
export function criticalStateChanged(
  current: WidgetState,
  snapshot: StateSnapshot | null
): boolean {
  if (!snapshot) {
    return true;
  }

  return (
    snapshot.messageCount !== current.messages.length ||
    snapshot.isTaskRunning !== current.isTaskRunning ||
    snapshot.activeTaskId !== current.activeTaskId ||
    taskProgressChanged(current, snapshot)
  );
}

/**
 * Check if state has meaningful content worth saving
 */
export function hasMeaningfulState(state: WidgetState): boolean {
  return (
    state.messages.length > 0 ||
    state.isTaskRunning ||
    state.taskProgress.length > 0 ||
    state.activeTaskId !== null
  );
}

/**
 * Check if task just completed (transition from running to not running)
 */
export function taskJustCompleted(current: WidgetState, previous: WidgetState): boolean {
  return previous.isTaskRunning && !current.isTaskRunning;
}

/**
 * Save Decision Service
 *
 * Centralized logic for determining when to save chat context.
 * Single source of truth for persistence decisions.
 */

import type { WidgetState } from '../types';
import {
  criticalStateChanged,
  hasMeaningfulState,
  newMessagesAdded,
  type StateSnapshot,
  taskJustCompleted,
  taskProgressChanged,
  uiStateChanged,
} from '../utils/stateComparisonUtils';
import { isScreenSharing } from './screenShareService';

export interface SaveDecision {
  shouldSave: boolean;
  shouldSaveImmediately: boolean;
  reason?: string;
}

/**
 * Determine if state should be saved and whether it should be immediate
 */
export function shouldSaveState(
  current: WidgetState,
  previous: WidgetState,
  previousMessages: WidgetState['messages'],
  lastSaved: StateSnapshot | null
): SaveDecision {
  // Check if task just completed
  const taskCompleted = taskJustCompleted(current, previous);

  // Check if new messages were added
  const messagesAdded = newMessagesAdded(current.messages, previousMessages);

  // Check if task progress changed
  const progressChanged = taskProgressChanged(current, lastSaved);

  // Check if critical state changed
  const criticalChanged = criticalStateChanged(current, lastSaved);

  // Check if UI state changed
  const uiChanged = uiStateChanged(current, lastSaved);

  // Determine if we should save immediately (no debounce)
  const shouldSaveImmediately =
    (isScreenSharing() && current.isTaskRunning) ||
    taskCompleted ||
    messagesAdded ||
    progressChanged;

  // Determine if we should save at all
  const shouldSave = (criticalChanged || uiChanged) && hasMeaningfulState(current);

  if (!shouldSave) {
    return { shouldSave: false, shouldSaveImmediately: false };
  }

  // Determine reason for logging
  let reason: string;
  if (taskCompleted) {
    reason = 'task completed/failed';
  } else if (messagesAdded) {
    reason = 'new messages added';
  } else if (progressChanged) {
    reason = 'task progress changed';
  } else if (isScreenSharing() && current.isTaskRunning) {
    reason = 'screenshare active and task running';
  } else {
    reason = 'state changed';
  }

  return {
    shouldSave: true,
    shouldSaveImmediately,
    reason,
  };
}

/**
 * Get debounce time based on update type
 */
export function getDebounceTime(state: WidgetState): number {
  const isCriticalUpdate =
    state.messages.length > 0 || state.isTaskRunning || state.taskProgress.length > 0;

  return isCriticalUpdate ? 200 : 500;
}

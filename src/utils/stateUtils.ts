/**
 * State Update Utilities
 *
 * Helper functions for common state update patterns to reduce code duplication.
 */

import type React from 'react';

import type { ChatMessage, WidgetState } from '../types';
import { findTaskMessageIndex } from './messageContentUtils';

/**
 * Generic state updater that merges partial updates
 */
export function updateState<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  updates: Partial<T>
): void {
  setState((prev) => ({ ...prev, ...updates }));
}

/**
 * Update messages in widget state
 */
export function updateMessages(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  updater: (messages: ChatMessage[]) => ChatMessage[]
): void {
  setState((prev) => ({
    ...prev,
    messages: updater(prev.messages),
  }));
}

/**
 * Reset task-related state
 */
export function resetTaskState(setState: React.Dispatch<React.SetStateAction<WidgetState>>): void {
  setState((prev) => ({
    ...prev,
    isTaskRunning: false,
    activeTaskId: null,
    taskProgress: [],
    isLoading: false,
  }));
}

/**
 * Add a message to the state
 */
export function addMessage(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  message: ChatMessage
): void {
  setState((prev) => ({
    ...prev,
    messages: [...prev.messages, message],
  }));
}

/**
 * Update a specific message in the state
 */
export function updateMessage(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  messageId: string,
  updates: Partial<ChatMessage>
): void {
  setState((prev) => ({
    ...prev,
    messages: prev.messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg)),
  }));
}

/**
 * Remove a message from the state
 */
export function removeMessage(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  messageId: string
): void {
  setState((prev) => ({
    ...prev,
    messages: prev.messages.filter((msg) => msg.id !== messageId),
  }));
}

/**
 * Find and update the task message using a custom updater function
 */
export function findAndUpdateTaskMessage(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  updater: (message: ChatMessage) => ChatMessage
): boolean {
  let updated = false;
  setState((prev) => {
    const messages = [...prev.messages];
    const taskMessageIndex = findTaskMessageIndex(messages);

    if (taskMessageIndex >= 0) {
      const updatedMessage = updater(messages[taskMessageIndex]);
      messages[taskMessageIndex] = updatedMessage;
      updated = true;
      return {
        ...prev,
        messages,
      };
    }

    return prev;
  });
  return updated;
}

/**
 * Update a message with progress line changes
 * This is a convenience function that combines finding the task message and updating it
 */
export function updateMessageWithProgress(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  progressUpdater: (message: ChatMessage) => ChatMessage
): void {
  findAndUpdateTaskMessage(setState, progressUpdater);
}

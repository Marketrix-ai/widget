/**
 * State Update Utilities
 *
 * Helper functions for common state update patterns to reduce code duplication.
 */

import type React from 'react';

import type { ChatMessage, WidgetState } from '../types';

/**
 * Add a message to the state
 */
export function addMessage(setState: React.Dispatch<React.SetStateAction<WidgetState>>, message: ChatMessage): void {
  setState(prev => ({
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
  updates: Partial<ChatMessage>,
): void {
  setState(prev => ({
    ...prev,
    messages: prev.messages.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg)),
  }));
}

/**
 * Remove a message from the state
 */
export function removeMessage(setState: React.Dispatch<React.SetStateAction<WidgetState>>, messageId: string): void {
  setState(prev => ({
    ...prev,
    messages: prev.messages.filter(msg => msg.id !== messageId),
  }));
}

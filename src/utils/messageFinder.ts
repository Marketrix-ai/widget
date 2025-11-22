/**
 * Message Finder Utility
 *
 * Centralized logic for finding messages in the chat that should receive
 * progress updates, tool call results, or errors. Eliminates duplicate
 * message finding code across websocket handlers.
 */

import type { ChatMessage, InstructionType } from '../types';
import { createLogger } from './logger';
import { findTaskMessageIndex } from './messageContentUtils';

const log = createLogger('MessageFinder');

export interface FindMessageOptions {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  currentMode: InstructionType;
  preferPlaceholder?: boolean;
  requireContent?: boolean;
}

/**
 * Find the message that should receive progress updates
 * Priority order for active show/do tasks:
 * 1. Placeholder message in show/do mode that has content (the "Let me try this" message)
 * 2. Placeholder message in show/do mode (even without content yet)
 * 3. Non-placeholder agent message in show/do mode
 * For other cases:
 * 4. Last placeholder message
 * 5. Last task message
 * 6. Any agent message as fallback
 */
export function findMessageForProgress(options: FindMessageOptions): {
  index: number;
  message: ChatMessage;
} | null {
  const { messages, isTaskRunning, currentMode, preferPlaceholder, requireContent } = options;
  let taskMessageIndex = -1;

  // For active show/do tasks, find the message that matches the current mode and task state
  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    // Priority 1: Find placeholder with content in matching mode (the active task message)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.sender === 'agent' &&
        msg.isPlaceholder &&
        !msg.isSystemMessage &&
        !msg.isScreenAccessRequest &&
        msg.mode === currentMode &&
        (!requireContent || msg.content.trim().length > 0)
      ) {
        taskMessageIndex = i;
        log.debug('Found active task placeholder with content for progress update', {
          messageId: msg.id,
          content: msg.content.substring(0, 50),
          mode: msg.mode,
          index: i,
        });
        break;
      }
    }

    // Priority 2: Find placeholder in matching mode (even without content)
    if (taskMessageIndex < 0 && !requireContent) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (
          msg.sender === 'agent' &&
          msg.isPlaceholder &&
          !msg.isSystemMessage &&
          !msg.isScreenAccessRequest &&
          msg.mode === currentMode
        ) {
          taskMessageIndex = i;
          log.debug('Found active task placeholder for progress update', {
            messageId: msg.id,
            mode: msg.mode,
            index: i,
          });
          break;
        }
      }
    }

    // Priority 3: Find non-placeholder agent message in matching mode
    if (taskMessageIndex < 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (
          msg.sender === 'agent' &&
          !msg.isPlaceholder &&
          !msg.isSystemMessage &&
          !msg.isScreenAccessRequest &&
          msg.mode === currentMode
        ) {
          taskMessageIndex = i;
          log.debug('Found active task message for progress update', {
            messageId: msg.id,
            mode: msg.mode,
            index: i,
          });
          break;
        }
      }
    }
  }

  // Fallback: If not in active task or no matching message found, use general logic
  if (taskMessageIndex < 0) {
    // Check ALL placeholder messages (not just last one) if preferPlaceholder is true
    if (preferPlaceholder !== false) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (
          msg.sender === 'agent' &&
          msg.isPlaceholder &&
          !msg.isSystemMessage &&
          !msg.isScreenAccessRequest
        ) {
          taskMessageIndex = i;
          log.debug('Found placeholder message for progress update (fallback)', {
            messageId: msg.id,
            index: i,
          });
          break;
        }
      }
    }

    // If still not found, try to find a task message (non-placeholder agent message)
    if (taskMessageIndex < 0) {
      taskMessageIndex = findTaskMessageIndex(messages);
      if (taskMessageIndex >= 0) {
        log.debug('Found task message for progress update (fallback)', {
          messageId: messages[taskMessageIndex].id,
          index: taskMessageIndex,
        });
      }
    }

    // Last resort: try to find ANY agent message as fallback
    if (taskMessageIndex < 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest) {
          taskMessageIndex = i;
          log.warn('Using any agent message for progress update (last resort)', {
            messageId: msg.id,
            isPlaceholder: msg.isPlaceholder,
            mode: msg.mode,
            index: i,
          });
          break;
        }
      }
    }
  }

  if (taskMessageIndex >= 0) {
    return {
      index: taskMessageIndex,
      message: messages[taskMessageIndex],
    };
  }

  return null;
}

/**
 * Find a placeholder message, optionally matching the current mode
 */
export function findPlaceholderMessage(
  messages: ChatMessage[],
  currentMode?: InstructionType
): { index: number; message: ChatMessage } | null {
  // First, try to find a placeholder matching the current mode
  if (currentMode) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.sender === 'agent' &&
        msg.isPlaceholder &&
        !msg.isSystemMessage &&
        !msg.isScreenAccessRequest &&
        (msg.mode === currentMode || !msg.mode)
      ) {
        return { index: i, message: msg };
      }
    }
  }

  // Fallback: find any placeholder
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      msg.sender === 'agent' &&
      msg.isPlaceholder &&
      !msg.isSystemMessage &&
      !msg.isScreenAccessRequest
    ) {
      return { index: i, message: msg };
    }
  }

  return null;
}

/**
 * Find the task message (non-placeholder agent message)
 */
export function findTaskMessage(messages: ChatMessage[]): {
  index: number;
  message: ChatMessage;
} | null {
  const index = findTaskMessageIndex(messages);
  if (index >= 0) {
    return { index, message: messages[index] };
  }
  return null;
}

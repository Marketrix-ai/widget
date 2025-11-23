/**
 * Message Finder Utility
 *
 * Centralized logic for finding messages in the chat that should receive
 * progress updates, tool call results, or errors. Eliminates duplicate
 * message finding code across websocket handlers.
 */

import type { ChatMessage, InstructionType } from '../types';
import { findTaskMessageIndex } from './messageContentUtils';

export interface FindMessageOptions {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  currentMode: InstructionType;
  preferPlaceholder?: boolean;
  requireContent?: boolean;
}

/**
 * Helper function to check if a message matches the criteria for progress updates
 */
function matchesProgressCriteria(
  msg: ChatMessage,
  isTaskRunning: boolean,
  currentMode: InstructionType,
  _preferPlaceholder: boolean | undefined,
  requireContent: boolean | undefined,
  checkMode: boolean
): boolean {
  // Basic sender and type checks
  if (msg.sender !== 'agent' || msg.isSystemMessage || msg.isScreenAccessRequest) {
    return false;
  }

  // For active show/do tasks, check mode matching
  // BUT: Be lenient for placeholders - allow mode mismatch if placeholder mode is undefined
  // This handles race conditions where tool calls arrive before mode is set
  if (checkMode && isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    // For placeholders, allow mode mismatch if mode is undefined (will be set later)
    // For non-placeholders, require strict mode matching
    if (msg.isPlaceholder) {
      // Placeholder: allow if mode matches OR mode is undefined
      if (msg.mode !== undefined && msg.mode !== currentMode) {
        return false;
      }
    } else {
      // Non-placeholder: require strict mode matching
      if (msg.mode !== currentMode) {
        return false;
      }
    }
  }

  // Content requirement check
  // With object-based progress, content might be empty but progressSteps present
  if (requireContent) {
    const hasText = msg.content.trim().length > 0;
    const hasProgress = msg.progressSteps && msg.progressSteps.length > 0;
    if (!hasText && !hasProgress) {
      return false;
    }
  }

  return true;
}

/**
 * Find the message that should receive progress updates
 * ALWAYS returns the LAST (most recent) matching message by searching backwards.
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
  console.log('[MessageFinder] [FLOW] findMessageForProgress called', {
    totalMessages: messages.length,
    isTaskRunning,
    currentMode,
    preferPlaceholder,
    requireContent,
    messageIds: messages.map((m, i) => ({
      index: i,
      id: m.id,
      isPlaceholder: m.isPlaceholder,
      sender: m.sender,
      mode: m.mode,
    })),
  });
  let taskMessageIndex = -1;
  let checkMode = false;

  // For active show/do tasks, find the message that matches the current mode and task state
  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    checkMode = true;

    // Priority 1: Find LAST placeholder with content in matching mode
    console.log(
      '[MessageFinder] [FLOW] Searching Priority 1: Placeholder with content in matching mode'
    );
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const matchesCriteria = matchesProgressCriteria(
        msg,
        isTaskRunning,
        currentMode,
        preferPlaceholder,
        requireContent,
        checkMode
      );
      const isPlaceholder = msg.isPlaceholder;
      const hasContent =
        !requireContent ||
        msg.content.trim().length > 0 ||
        (msg.progressSteps && msg.progressSteps.length > 0);

      console.log('[MessageFinder] [FLOW] Checking message (Priority 1)', {
        index: i,
        messageId: msg.id,
        sender: msg.sender,
        isPlaceholder,
        mode: msg.mode,
        currentMode,
        matchesCriteria,
        hasContent,
        contentLength: msg.content.trim().length,
        progressStepsCount: msg.progressSteps?.length,
        willMatch: matchesCriteria && isPlaceholder && hasContent,
      });

      if (matchesCriteria && isPlaceholder && hasContent) {
        taskMessageIndex = i;
        console.log('[MessageFinder] [FLOW] SELECTED message (Priority 1)', {
          index: taskMessageIndex,
          messageId: msg.id,
          reason: 'Placeholder with content in matching mode',
        });
        break;
      }
    }

    // Priority 2: Find LAST placeholder in matching mode (even without content)
    if (taskMessageIndex < 0 && !requireContent) {
      console.log(
        '[MessageFinder] [FLOW] Searching Priority 2: Placeholder in matching mode (no content requirement)'
      );
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const matchesCriteria = matchesProgressCriteria(
          msg,
          isTaskRunning,
          currentMode,
          preferPlaceholder,
          requireContent,
          checkMode
        );
        const isPlaceholder = msg.isPlaceholder;

        console.log('[MessageFinder] [FLOW] Checking message (Priority 2)', {
          index: i,
          messageId: msg.id,
          sender: msg.sender,
          isPlaceholder,
          mode: msg.mode,
          currentMode,
          matchesCriteria,
          willMatch: matchesCriteria && isPlaceholder,
        });

        if (matchesCriteria && isPlaceholder) {
          taskMessageIndex = i;
          console.log('[MessageFinder] [FLOW] SELECTED message (Priority 2)', {
            index: taskMessageIndex,
            messageId: msg.id,
            reason: 'Placeholder in matching mode',
          });
          break;
        }
      }
    }

    // Priority 3: Find LAST non-placeholder agent message in matching mode
    if (taskMessageIndex < 0) {
      console.log(
        '[MessageFinder] [FLOW] Searching Priority 3: Non-placeholder agent message in matching mode'
      );
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const matchesCriteria = matchesProgressCriteria(
          msg,
          isTaskRunning,
          currentMode,
          preferPlaceholder,
          requireContent,
          checkMode
        );
        const isPlaceholder = msg.isPlaceholder;

        console.log('[MessageFinder] [FLOW] Checking message (Priority 3)', {
          index: i,
          messageId: msg.id,
          sender: msg.sender,
          isPlaceholder,
          mode: msg.mode,
          currentMode,
          matchesCriteria,
          willMatch: matchesCriteria && !isPlaceholder,
        });

        if (matchesCriteria && !isPlaceholder) {
          taskMessageIndex = i;
          console.log('[MessageFinder] [FLOW] SELECTED message (Priority 3)', {
            index: taskMessageIndex,
            messageId: msg.id,
            reason: 'Non-placeholder agent message in matching mode',
          });
          break;
        }
      }
    }
  }

  // Fallback: If not in active task or no matching message found, use general logic
  // This is critical - tool calls can arrive before isTaskRunning is set to true
  if (taskMessageIndex < 0) {
    console.log('[MessageFinder] [FLOW] Using fallback logic (task not running or no match found)');
    // Priority 1: Check LAST placeholder message (preferred for progress updates)
    // Don't require mode matching or content when task isn't running yet
    // ALWAYS check for placeholders first, regardless of preferPlaceholder flag
    // This ensures we find existing placeholders before creating new ones
    console.log('[MessageFinder] [FLOW] Searching Fallback Priority 1: Placeholder with content');
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const isAgent = msg.sender === 'agent';
      const isPlaceholder = msg.isPlaceholder;
      const notSystem = !msg.isSystemMessage;
      const notScreenAccess = !msg.isScreenAccessRequest;
      const hasContent =
        !requireContent ||
        msg.content.trim().length > 0 ||
        (msg.progressSteps && msg.progressSteps.length > 0);

      console.log('[MessageFinder] [FLOW] Checking message (Fallback Priority 1)', {
        index: i,
        messageId: msg.id,
        isAgent,
        isPlaceholder,
        notSystem,
        notScreenAccess,
        hasContent,
        contentLength: msg.content.trim().length,
        willMatch: isAgent && isPlaceholder && notSystem && notScreenAccess && hasContent,
      });

      if (isAgent && isPlaceholder && notSystem && notScreenAccess && hasContent) {
        taskMessageIndex = i;
        console.log('[MessageFinder] [FLOW] SELECTED message (Fallback Priority 1)', {
          index: taskMessageIndex,
          messageId: msg.id,
          mode: msg.mode,
          currentMode,
          reason: 'Placeholder with content in fallback',
        });
        break;
      }
    }

    // Priority 2: If still not found, try placeholder without content requirement
    if (taskMessageIndex < 0 && !requireContent) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (
          msg.sender === 'agent' &&
          msg.isPlaceholder &&
          !msg.isSystemMessage &&
          !msg.isScreenAccessRequest
        ) {
          taskMessageIndex = i;
          console.log('[MessageFinder] [FLOW] Found placeholder in fallback (Priority 2)', {
            index: taskMessageIndex,
            messageId: msg.id,
            mode: msg.mode,
            currentMode,
          });
          break;
        }
      }
    }

    // Priority 3: Try to find the last task message (non-placeholder agent message)
    if (taskMessageIndex < 0) {
      taskMessageIndex = findTaskMessageIndex(messages);
      if (taskMessageIndex >= 0) {
        console.log('[MessageFinder] [FLOW] Found task message in fallback (Priority 3)', {
          index: taskMessageIndex,
          messageId: messages[taskMessageIndex].id,
        });
      }
    }

    // Priority 4: Last resort - find ANY agent message (ensures we always find something if possible)
    if (taskMessageIndex < 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest) {
          taskMessageIndex = i;
          console.log('[MessageFinder] [FLOW] Found any agent message in fallback (Priority 4)', {
            index: taskMessageIndex,
            messageId: msg.id,
          });
          break;
        }
      }
    }
  }

  if (taskMessageIndex >= 0) {
    const found = {
      index: taskMessageIndex,
      message: messages[taskMessageIndex],
    };
    console.log('[MessageFinder] [FLOW] Found message', {
      index: found.index,
      messageId: found.message.id,
      isPlaceholder: found.message.isPlaceholder,
      sender: found.message.sender,
      mode: found.message.mode,
      contentPreview: found.message.content.substring(0, 100),
    });
    return found;
  }

  console.warn('[MessageFinder] [FLOW] No message found for progress update', {
    totalMessages: messages.length,
    isTaskRunning,
    currentMode,
    preferPlaceholder,
  });
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
export { findTaskMessageIndex } from './messageContentUtils';

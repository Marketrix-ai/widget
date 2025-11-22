/**
 * State Restoration Service
 *
 * Handles restoration of chat context from storage, separating restoration
 * logic from initialization. Provides clean interfaces for early restoration
 * and chat ID-specific restoration.
 */

import type { ChatMessage, InstructionType, TaskProgress, WidgetState } from '../types';
import { getStoredChatContext, type StoredChatContext } from '../utils/chatStorage';
import { createLogger } from '../utils/logger';
import {
  addThinkingMarker,
  parseProgressLines,
  reconstructMessageContent,
  removeThinkingMarkers,
} from '../utils/messageContentUtils';
import { createSystemMessage } from '../utils/messageFactory';

const log = createLogger('StateRestoration');

export interface RestoredState {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  activeTaskId: string | null;
  taskProgress: TaskProgress[];
  currentMode: InstructionType;
  isOpen: boolean;
  isMinimized: boolean;
  chatIdChanged: boolean;
}

/**
 * Restore messages from stored context
 * Cleans __THINKING__ markers and validates progress line format
 */
function restoreMessagesFromContext(context: StoredChatContext): ChatMessage[] {
  try {
    const restored = context.messages.map((msg) => {
      // Remove any __THINKING__ markers that might have been stored
      let cleanContent = removeThinkingMarkers(msg.content);

      // Validate and clean progress lines using utility functions
      const { mainContent, progressLines } = parseProgressLines(cleanContent);

      // Filter progress lines to keep only valid ones (starting with ○ or ●✓)
      // or lines that are part of the main content (not progress lines)
      const validProgressLines = progressLines.filter((line) => {
        const trimmed = line.trim();
        return (
          trimmed.length > 0 &&
          (trimmed.startsWith('○') || trimmed.startsWith('●✓') || !trimmed.match(/^[○●✓]/))
        );
      });

      // Reconstruct content with validated progress lines
      cleanContent = reconstructMessageContent(mainContent, validProgressLines);

      return {
        id: msg.id,
        content: cleanContent,
        sender: msg.sender,
        timestamp: new Date(msg.timestamp),
        mode: msg.mode,
        isScreenAccessRequest: msg.isScreenAccessRequest,
        isSystemMessage: msg.isSystemMessage,
        isPlaceholder: msg.isPlaceholder ?? false,
      };
    });

    // Log system messages being restored for verification
    const systemMessages = restored.filter((msg) => msg.isSystemMessage);
    if (systemMessages.length > 0) {
      console.log('[State Restoration] Restoring system messages:', {
        count: systemMessages.length,
        messages: systemMessages.map((m) => ({ id: m.id, content: m.content })),
      });
    }

    return restored;
  } catch (error) {
    console.warn('[State Restoration] Failed to restore messages:', error);
    return [];
  }
}

/**
 * Clean and restore messages from stored context
 */
function cleanRestoredMessages(storedContext: StoredChatContext): ChatMessage[] {
  const restoredMessages = restoreMessagesFromContext(storedContext);

  // Clean up messages: validate progress lines and ensure thinking markers are added for active tasks
  return restoredMessages.map((msg) => {
    const cleanContent = removeThinkingMarkers(msg.content);
    const { mainContent, progressLines } = parseProgressLines(cleanContent);
    const validProgressLines = progressLines.filter((line) => line.trim().length > 0);
    let finalContent = reconstructMessageContent(mainContent, validProgressLines);

    // If this is a placeholder with progress lines and task was running, add thinking marker
    if (
      msg.isPlaceholder &&
      validProgressLines.length > 0 &&
      storedContext.isTaskRunning &&
      (storedContext.currentMode === 'show' || storedContext.currentMode === 'do')
    ) {
      // Add thinking marker to show agent is still processing
      finalContent = addThinkingMarker(finalContent);
    }

    return {
      ...msg,
      content: finalContent,
    };
  });
}

/**
 * Restore state from storage
 * Handles both early restoration (before chat ID) and chat ID-specific restoration
 * @param chatId - Optional chat ID. If provided, handles chat ID changes gracefully
 * @param currentState - Optional current state. If provided, checks if restoration is needed
 */
export function restoreState(chatId?: string, currentState?: WidgetState): RestoredState | null {
  const storedContext = getStoredChatContext(chatId);
  if (!storedContext) {
    log.debug('No stored context found for restoration');
    return null;
  }

  const isEarlyRestoration = !chatId;
  const chatIdChanged = chatId ? storedContext.chat_id !== chatId : false;

  // Log restoration details
  if (isEarlyRestoration) {
    log.info('Restoring FULL context early from storage:', {
      messageCount: storedContext.messages.length,
      isOpen: storedContext.isOpen,
      isMinimized: storedContext.isMinimized,
      storedChatId: storedContext.chat_id,
      isTaskRunning: storedContext.isTaskRunning,
      currentMode: storedContext.currentMode,
    });
  } else {
    const systemMessageCount = storedContext.messages.filter((m) => m.isSystemMessage).length;
    log.debug('Restoring context from storage:', {
      messageCount: storedContext.messages.length,
      systemMessageCount,
      isTaskRunning: storedContext.isTaskRunning,
      activeTaskId: storedContext.activeTaskId,
      currentMode: storedContext.currentMode,
      isOpen: storedContext.isOpen,
      isMinimized: storedContext.isMinimized,
      chatIdChanged,
      storedChatId: storedContext.chat_id,
      currentChatId: chatId,
    });
  }

  // For chat ID-specific restoration, check if we should skip
  if (chatId && currentState) {
    const alreadyHasMessages = currentState.messages.length > 0;
    if (alreadyHasMessages && !chatIdChanged) {
      log.debug('Messages already restored, skipping restoration');
      return null;
    }
  }

  const cleanedMessages = cleanRestoredMessages(storedContext);

  // Handle early restoration: filter out "Chat context changed" messages
  // These are transient and will be re-added if needed when chat ID is known
  let finalMessages = cleanedMessages;
  if (isEarlyRestoration) {
    finalMessages = cleanedMessages.filter(
      (msg) => !(msg.isSystemMessage && msg.content === 'Chat context changed')
    );
    log.info('Early context restoration complete', {
      messageCount: finalMessages.length,
      systemMessageCount: finalMessages.filter((m) => m.isSystemMessage).length,
    });
  } else if (chatIdChanged && currentState) {
    // Handle chat ID change: append context change message if needed
    const alreadyHasMessages = currentState.messages.length > 0;
    const messagesWithoutContextChange = (
      alreadyHasMessages ? currentState.messages : cleanedMessages
    ).filter((msg) => !(msg.isSystemMessage && msg.content === 'Chat context changed'));

    const hasContextChangeMessage = messagesWithoutContextChange.some(
      (msg) => msg.isSystemMessage && msg.content === 'Chat context changed'
    );

    if (!hasContextChangeMessage) {
      const contextChangeMessage = createSystemMessage(
        'Chat context changed',
        storedContext.currentMode,
        'agent',
        'context-changed'
      );
      finalMessages = [...messagesWithoutContextChange, contextChangeMessage];
      log.debug('Chat ID changed, appended context change message');
    } else {
      finalMessages = messagesWithoutContextChange;
      log.debug('Chat ID changed, but context change message already exists, skipping');
    }
  }

  return {
    messages: finalMessages,
    // Only restore task state if chat ID hasn't changed (tasks are chat-specific)
    isTaskRunning: chatIdChanged ? false : storedContext.isTaskRunning,
    activeTaskId: chatIdChanged ? null : storedContext.activeTaskId,
    taskProgress: chatIdChanged ? [] : storedContext.taskProgress,
    currentMode: storedContext.currentMode,
    isOpen: storedContext.isOpen,
    isMinimized: storedContext.isMinimized,
    chatIdChanged,
  };
}

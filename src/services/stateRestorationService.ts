/**
 * State Restoration Service
 *
 * Handles restoration of chat context from storage, separating restoration
 * logic from initialization. Provides clean interfaces for early restoration
 * and chat ID-specific restoration.
 */

import type { ChatMessage, InstructionType, TaskProgress, WidgetState } from '../types';
import {
  getAnyStoredChatContext,
  getStoredChatContext,
  restoreMessagesFromContext,
  type StoredChatContext,
} from '../utils/chatStorage';
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
 * Restore state early (before chat ID initialization)
 * Returns null if no stored context exists
 */
export function restoreEarlyState(): RestoredState | null {
  const storedContext = getAnyStoredChatContext();
  if (!storedContext) {
    log.debug('No stored context found for early restoration');
    return null;
  }

  log.info('Restoring FULL context early from storage:', {
    messageCount: storedContext.messages.length,
    isOpen: storedContext.isOpen,
    isMinimized: storedContext.isMinimized,
    storedChatId: storedContext.chat_id,
    isTaskRunning: storedContext.isTaskRunning,
    currentMode: storedContext.currentMode,
  });

  // Restore messages immediately
  const cleanedMessages = cleanRestoredMessages(storedContext);

  // Filter out "Chat context changed" messages from early restoration
  // These are transient and will be re-added by restoreForChatId if needed
  const messagesWithoutContextChange = cleanedMessages.filter(
    (msg) => !(msg.isSystemMessage && msg.content === 'Chat context changed')
  );

  // Log system messages for verification
  const systemMessages = messagesWithoutContextChange.filter((m) => m.isSystemMessage);
  log.info('Early context restoration complete', {
    messageCount: messagesWithoutContextChange.length,
    systemMessageCount: systemMessages.length,
    restoredMessageIds: messagesWithoutContextChange.map((m) => m.id).slice(0, 5),
    systemMessages: systemMessages.map((m) => ({ id: m.id, content: m.content })),
    filteredContextChangeMessages: cleanedMessages.length - messagesWithoutContextChange.length,
  });

  return {
    messages: messagesWithoutContextChange,
    isTaskRunning: storedContext.isTaskRunning,
    activeTaskId: storedContext.activeTaskId,
    taskProgress: storedContext.taskProgress,
    currentMode: storedContext.currentMode,
    isOpen: storedContext.isOpen,
    isMinimized: storedContext.isMinimized,
    chatIdChanged: false, // Early restoration doesn't check chat ID
  };
}

/**
 * Restore state for a specific chat ID
 * Handles chat ID changes gracefully by preserving history and appending a system message
 */
export function restoreStateForChatId(
  chatId: string,
  currentState: WidgetState
): RestoredState | null {
  const storedContext = getStoredChatContext(chatId);
  if (!storedContext) {
    log.debug('No stored context found for restoration');
    return null;
  }

  const chatIdChanged = storedContext.chat_id !== chatId;

  // Count system messages for logging
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

  const alreadyHasMessages = currentState.messages.length > 0;

  // If messages already exist and chat ID hasn't changed, don't overwrite
  if (alreadyHasMessages && !chatIdChanged) {
    log.debug('Messages already restored, skipping restoration');
    return null;
  }

  const cleanedMessages = cleanRestoredMessages(storedContext);

  // If chat ID changed, append context change message (but only if one doesn't already exist)
  // Filter out any existing "Chat context changed" messages first to avoid duplicates
  let finalMessages = cleanedMessages;
  if (chatIdChanged) {
    // Remove any existing "Chat context changed" messages to avoid duplicates
    const messagesWithoutContextChange = (
      alreadyHasMessages ? currentState.messages : cleanedMessages
    ).filter((msg) => !(msg.isSystemMessage && msg.content === 'Chat context changed'));

    // Check if a context change message already exists
    const hasContextChangeMessage = messagesWithoutContextChange.some(
      (msg) => msg.isSystemMessage && msg.content === 'Chat context changed'
    );

    if (!hasContextChangeMessage) {
      // Append context change message only if one doesn't exist
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

  // When chat ID changes, reset task state (tasks are tied to specific chat IDs)
  // But preserve messages and mode
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

/**
 * WebSocket Message Handlers
 *
 * Extracted handlers for WebSocket messages to improve separation of concerns.
 * These handlers manage tool call progress, results, errors, and task status updates.
 */

import type React from 'react';

import type { ChatMessage, WidgetState } from '../types';
import { getPendingToolCall, getStoredChatId } from '../utils/chatStorage';
import { createLogger } from '../utils/logger';
import {
  findLastIncompleteProgressLineIndex,
  parseProgressLines,
} from '../utils/messageContentUtils';
import { createPlaceholderMessage, createSystemMessage } from '../utils/messageFactory';
import { findMessageForProgress } from '../utils/messageFinder';
import {
  addProgressLine,
  markProgressLineComplete,
  markProgressLineFailed,
  updateProgressLine,
  updateThinkingMarker,
} from '../utils/progressLineManager';
import type { WebSocketMessage, WebSocketStatus } from './websocketService';

const log = createLogger('WebSocketHandler');

// Constants
const TOOL_CALL_METHOD = 'tools/call';
const TASK_STATUS_METHOD = 'task/status';

// Type definitions for message params
interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
  mode?: string;
  explanation?: string;
}

interface ToolCallResult {
  content?: Array<{ type?: string; text?: string }>;
}

interface TaskStatusParams {
  status: string;
  message?: string;
  timestamp?: string;
  task_id?: string;
}

// Type guards
function isToolCallProgressMessage(message: WebSocketMessage): message is WebSocketMessage & {
  method: typeof TOOL_CALL_METHOD;
  id: string | number;
  params: ToolCallParams;
} {
  if (message.method !== TOOL_CALL_METHOD || !message.id) {
    return false;
  }
  const params = message.params as ToolCallParams | undefined;
  return !!params?.name && !message.result && !message.error;
}

function isToolCallResultMessage(message: WebSocketMessage): message is WebSocketMessage & {
  method: typeof TOOL_CALL_METHOD;
  id: string | number;
  result: ToolCallResult;
} {
  if (message.method !== TOOL_CALL_METHOD || !message.id || !message.result) {
    return false;
  }
  // Result message has no params (or empty params) and no error
  const hasParams =
    message.params !== undefined &&
    message.params !== null &&
    typeof message.params === 'object' &&
    Object.keys(message.params as Record<string, unknown>).length > 0;
  return !hasParams && !message.error;
}

function isToolCallErrorMessage(message: WebSocketMessage): message is WebSocketMessage & {
  method: typeof TOOL_CALL_METHOD;
  id: string | number;
  error: { code: number; message: string };
} {
  if (message.method !== TOOL_CALL_METHOD || !message.id || !message.error) {
    return false;
  }
  // Error message has no params (or empty params)
  const hasParams =
    message.params !== undefined &&
    message.params !== null &&
    typeof message.params === 'object' &&
    Object.keys(message.params as Record<string, unknown>).length > 0;
  return !hasParams;
}

function isTaskStatusMessage(message: WebSocketMessage): message is WebSocketMessage & {
  method: typeof TASK_STATUS_METHOD;
  params: TaskStatusParams;
} {
  return message.method === TASK_STATUS_METHOD && !!message.params;
}

// Helper functions
function updateMessageInState(
  prev: WidgetState,
  messageIndex: number,
  updater: (message: ChatMessage) => ChatMessage
): WidgetState {
  if (messageIndex < 0 || messageIndex >= prev.messages.length) {
    log.warn('Invalid message index for update', {
      messageIndex,
      totalMessages: prev.messages.length,
    });
    return prev;
  }

  const existingMessage = prev.messages[messageIndex];
  const updatedMessage = updater(existingMessage);

  if (updatedMessage === existingMessage) {
    return prev;
  }

  const updatedMessages = prev.messages.map((msg, idx) =>
    idx === messageIndex ? updatedMessage : msg
  );

  return {
    ...prev,
    messages: updatedMessages,
  };
}

function findTargetMessage(
  prev: WidgetState,
  activeMessageRef?: React.MutableRefObject<ChatMessage | null>
): { index: number; message: ChatMessage } | null {
  // Try activeMessageRef first (for progress updates)
  if (activeMessageRef?.current) {
    const activeMessageId = activeMessageRef.current.id;
    const messageIndex = prev.messages.findIndex((msg) => msg.id === activeMessageId);
    if (messageIndex >= 0) {
      return {
        index: messageIndex,
        message: prev.messages[messageIndex],
      };
    }
    log.warn('activeMessageRef message not found in state', {
      activeMessageId,
      totalMessages: prev.messages.length,
    });
  }

  // Fall back to findMessageForProgress utility
  return findMessageForProgress({
    messages: prev.messages,
    isTaskRunning: prev.isTaskRunning,
    currentMode: prev.currentMode,
    preferPlaceholder: true,
  });
}

function preserveMessageMode(
  message: ChatMessage,
  existingMode?: ChatMessage['mode'],
  currentMode?: ChatMessage['mode']
): ChatMessage {
  if (message.mode) {
    return message;
  }
  if (existingMode) {
    return { ...message, mode: existingMode };
  }
  if (currentMode) {
    return { ...message, mode: currentMode };
  }
  return message;
}

function syncActiveMessageRef(
  ref: React.MutableRefObject<ChatMessage | null>,
  _message: ChatMessage,
  index: number,
  messages: ChatMessage[]
): void {
  const updatedMessage = messages[index];
  if (updatedMessage) {
    ref.current = updatedMessage;
  }
}

/**
 * Create handler for WebSocket status changes
 */
export function createStatusChangeHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  retryPendingToolCall?: (chatId: string | null, websocketService: unknown) => void,
  initializedChatIdRef?: React.MutableRefObject<string | null>,
  websocketServiceRef?: React.MutableRefObject<unknown>
) {
  return (status: WebSocketStatus) => {
    log.debug('WebSocket status changed:', status);
    setState((prev) => ({
      ...prev,
      agentAvailable: status === 'registered' || status === 'connected',
    }));

    // When websocket is fully connected/registered, check for pending tool call to retry
    if ((status === 'registered' || status === 'connected') && retryPendingToolCall) {
      retryPendingToolCall(
        initializedChatIdRef?.current ?? null,
        websocketServiceRef?.current ?? null
      );
    }
  };
}

/**
 * Create handler for tool call progress updates
 */
export function createToolCallProgressHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  activeMessageRef: React.MutableRefObject<ChatMessage | null>
) {
  return (message: WebSocketMessage) => {
    if (!isToolCallProgressMessage(message)) {
      return;
    }

    const params = message.params;
    const toolName = params.name;
    const explanation = params.explanation || '';
    const progressText = explanation || `Executing ${toolName}...`;

    log.info('Processing tool call progress', {
      toolName,
      progressText,
      messageId: message.id,
    });

    setState((prev): WidgetState => {
      const foundMessage = findTargetMessage(prev, activeMessageRef);
      if (!foundMessage) {
        log.warn('No message found for progress update', {
          totalMessages: prev.messages.length,
          isTaskRunning: prev.isTaskRunning,
          currentMode: prev.currentMode,
        });
        return prev;
      }

      const { index: messageIndex, message: existingMessage } = foundMessage;

      const newState = updateMessageInState(prev, messageIndex, (msg) => {
        let updatedMessage = addProgressLine(msg, toolName, progressText);
        updatedMessage = preserveMessageMode(
          updatedMessage,
          existingMessage.mode,
          prev.currentMode
        );

        // Update thinking marker for show/do modes when task is running
        if (prev.isTaskRunning && (prev.currentMode === 'show' || prev.currentMode === 'do')) {
          updatedMessage = updateThinkingMarker(
            updatedMessage,
            prev.isTaskRunning,
            prev.currentMode
          );
        }

        return updatedMessage;
      });

      // Sync activeMessageRef after state update
      if (newState !== prev) {
        syncActiveMessageRef(
          activeMessageRef,
          newState.messages[messageIndex],
          messageIndex,
          newState.messages
        );
      }

      return newState;
    });
  };
}

/**
 * Create handler for tool call results
 */
export function createToolCallResultHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>
) {
  return (message: WebSocketMessage) => {
    if (!isToolCallResultMessage(message)) {
      return;
    }

    const result = message.result;
    if (!result?.content || result.content.length === 0) {
      return;
    }

    // Try to get tool name from pending tool call to match correctly
    let toolName: string | undefined = undefined;
    try {
      const chatId = getStoredChatId();
      if (chatId && message.id !== undefined) {
        const pendingToolCall = getPendingToolCall(chatId);
        if (pendingToolCall && pendingToolCall.requestId === message.id) {
          toolName = pendingToolCall.toolName;
        }
      }
    } catch {
      // Ignore errors getting pending tool call
    }

    setState((prev) => {
      const foundMessage = findTargetMessage(prev);

      if (foundMessage) {
        const { index: messageIndex } = foundMessage;
        return updateMessageInState(prev, messageIndex, (msg) => {
          return toolName
            ? updateProgressLine(msg, toolName, 'completed')
            : markProgressLineComplete(msg);
        });
      }

      // If no message found and messages array is empty, create a placeholder on the fly
      if (prev.messages.length === 0) {
        const placeholderMessage = createPlaceholderMessage(prev.currentMode);
        const updatedMessage = toolName
          ? updateProgressLine(
              addProgressLine(placeholderMessage, toolName, ''),
              toolName,
              'completed'
            )
          : placeholderMessage;
        return {
          ...prev,
          messages: [updatedMessage],
        };
      }

      return prev;
    });
  };
}

/**
 * Create handler for tool call errors
 */
export function createToolCallErrorHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>
) {
  return (message: WebSocketMessage) => {
    if (!isToolCallErrorMessage(message)) {
      return;
    }

    const error = message.error;
    if (!error?.message) {
      return;
    }

    const errorText = error.message || 'Tool execution failed';

    setState((prev) => {
      const foundMessage = findMessageForProgress({
        messages: prev.messages,
        isTaskRunning: prev.isTaskRunning,
        currentMode: prev.currentMode,
        preferPlaceholder: true,
        requireContent: true,
      });

      if (!foundMessage) {
        return prev;
      }

      const { index: messageIndex, message: existingMessage } = foundMessage;

      // Extract tool name from the last incomplete progress line
      const { progressLines } = parseProgressLines(existingMessage.content);
      const lastIncompleteIndex = findLastIncompleteProgressLineIndex(progressLines);

      if (lastIncompleteIndex < 0) {
        return prev;
      }

      const lastLine = progressLines[lastIncompleteIndex];
      // Extract tool name from progress line (text after ○ or ●✓)
      const toolNameMatch = lastLine.match(/^(?:●✓|○|●|✓)\s*(.+?)(?:\s*✗|$)/);
      const toolName = toolNameMatch ? toolNameMatch[1].split(' ')[0] : 'tool';

      return updateMessageInState(prev, messageIndex, (msg) =>
        markProgressLineFailed(msg, toolName, errorText)
      );
    });
  };
}

/**
 * Create handler for task status updates
 */
export function createTaskStatusHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  activeMessageRef: React.MutableRefObject<ChatMessage | null>
) {
  return (message: WebSocketMessage) => {
    if (!isTaskStatusMessage(message)) {
      return;
    }

    const params = message.params;
    const status = params.status;
    const statusMessage = params.message || '';
    const taskId = params.task_id;

    log.info('Task status update received', {
      status,
      message: statusMessage,
      taskId,
      timestamp: params.timestamp,
    });

    if (status === 'started' || status === 'running') {
      // Task has started - set running state
      setState((prev) => ({
        ...prev,
        activeTaskId: taskId || prev.activeTaskId,
        isTaskRunning: true,
        isLoading: false,
      }));
    } else if (status === 'stopped' || status === 'completed' || status === 'failed') {
      // Task has ended - clean up state and messages
      if (activeMessageRef) {
        activeMessageRef.current = null;
      }

      setState((prev) => {
        // Update messages: remove thinking markers and convert placeholders to regular messages
        const updatedMessages = prev.messages.map((msg) => {
          const contentWithoutThinking = msg.content
            .replace(/\n\n__THINKING__$/, '')
            .replace(/__THINKING__/g, '');

          if (msg.isPlaceholder) {
            return {
              ...msg,
              content: contentWithoutThinking,
              isPlaceholder: false,
              placeholderState: undefined,
            };
          }

          if (contentWithoutThinking !== msg.content) {
            return {
              ...msg,
              content: contentWithoutThinking,
            };
          }

          return msg;
        });

        // Add completion/failure message if status message is provided
        const finalMessages =
          statusMessage && statusMessage.trim().length > 0
            ? [...updatedMessages, createSystemMessage(statusMessage)]
            : updatedMessages;

        return {
          ...prev,
          activeTaskId: null,
          isTaskRunning: false,
          isLoading: false,
          messages: finalMessages,
        };
      });
    }
  };
}

/**
 * Create handler for WebSocket errors
 */
export function createErrorHandler(setState: React.Dispatch<React.SetStateAction<WidgetState>>) {
  return (error: Error) => {
    log.error('WebSocket error:', error);
    setState((prev) => ({
      ...prev,
      agentAvailable: false,
      error: error.message,
    }));
  };
}

/**
 * Create handler for tool call progress (legacy callback, now handled in onMessage)
 */
export function createToolCallProgressCallback() {
  return (toolName: string, explanation: string, mode: string) => {
    // Progress updates are now handled in onMessage callback
    log.debug(
      `Tool call progress callback received: ${toolName} - "${explanation}" (mode: ${mode})`
    );
  };
}

/**
 * Create combined message handler that routes to appropriate handlers based on message type
 * This is more efficient than calling all handlers for every message
 */
export function createMessageHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>,
  activeMessageRef: React.MutableRefObject<ChatMessage | null>
) {
  const progressHandler = createToolCallProgressHandler(setState, activeMessageRef);
  const resultHandler = createToolCallResultHandler(setState);
  const errorHandler = createToolCallErrorHandler(setState);
  const taskStatusHandler = createTaskStatusHandler(setState, activeMessageRef);

  return (message: WebSocketMessage) => {
    log.debug('WebSocket message received', {
      method: message.method,
      hasId: !!message.id,
      hasParams: !!message.params,
      hasResult: !!message.result,
      hasError: !!message.error,
    });

    // Route to appropriate handler based on message type using type guards
    if (isToolCallProgressMessage(message)) {
      log.info('Routing to progress handler', {
        toolName: message.params.name,
        explanation: message.params.explanation,
        messageId: message.id,
      });
      progressHandler(message);
    } else if (isToolCallResultMessage(message)) {
      log.info('Routing to result handler', {
        messageId: message.id,
      });
      resultHandler(message);
    } else if (isToolCallErrorMessage(message)) {
      log.debug('Routing to error handler', {
        messageId: message.id,
        error: message.error.message,
      });
      errorHandler(message);
    } else if (isTaskStatusMessage(message)) {
      taskStatusHandler(message);
    }
    // Note: Other message types are handled by WebSocketService directly
  };
}

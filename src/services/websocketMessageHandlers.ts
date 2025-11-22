/**
 * WebSocket Message Handlers
 *
 * Extracted handlers for WebSocket messages to improve separation of concerns.
 * These handlers manage tool call progress, results, errors, and task status updates.
 */

import type React from 'react';

import type { WidgetState } from '../types';
import { createLogger } from '../utils/logger';
import {
  findLastIncompleteProgressLineIndex,
  findTaskMessageIndex,
  parseProgressLines,
} from '../utils/messageContentUtils';
import {
  addProgressLine,
  markProgressLineComplete,
  markProgressLineFailed,
} from '../utils/progressLineManager';
import type { WebSocketMessage, WebSocketStatus } from './websocketService';

const log = createLogger('WebSocketHandler');

export interface WebSocketHandlerDependencies {
  setState: React.Dispatch<React.SetStateAction<WidgetState>>;
  retryPendingToolCall?: (chatId: string | null, websocketService: unknown) => void;
  initializedChatIdRef?: React.MutableRefObject<string | null>;
  websocketServiceRef?: React.MutableRefObject<unknown>;
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
  setState: React.Dispatch<React.SetStateAction<WidgetState>>
) {
  return (message: WebSocketMessage) => {
    // Handle tool call messages - update progress when tool calls are received
    if (message.method === 'tools/call' && message.id && message.params) {
      log.debug('Detected tool call message with params');
      const params = message.params as
        | {
            name?: string;
            arguments?: Record<string, unknown>;
            mode?: string;
            explanation?: string;
          }
        | undefined;

      if (params?.name) {
        const toolName = params.name;
        const explanation = params.explanation || '';
        const progressText = explanation || `Executing ${toolName}...`;

        log.debug(`Tool call received via onMessage: ${toolName} - "${progressText}"`);

        // Update progress immediately when tool call is received
        setState((prev) => {
          const messages = [...prev.messages];
          const taskMessageIndex = findTaskMessageIndex(messages);

          if (taskMessageIndex >= 0) {
            log.debug(`Found task message at index ${taskMessageIndex}`);
            const existingMessage = messages[taskMessageIndex];
            const updatedMessage = addProgressLine(existingMessage, toolName, progressText);

            const updatedMessages = [...messages];
            updatedMessages[taskMessageIndex] = updatedMessage;

            log.debug(`Updated content:`, updatedMessage.content.substring(0, 150));

            return {
              ...prev,
              messages: updatedMessages,
            };
          } else {
            log.warn(`No task message found! Messages count: ${messages.length}`);
          }

          return prev;
        });
      }
    }
  };
}

/**
 * Create handler for tool call results
 */
export function createToolCallResultHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>
) {
  return (message: WebSocketMessage) => {
    // Handle tool call results - mark tool as done when result is received
    // Check for result message: has result, has id, and either no params or params is empty/undefined
    const hasResult = !!message.result;
    const hasId = !!message.id;
    const hasParams =
      !!message.params && Object.keys(message.params as Record<string, unknown>).length > 0;
    const hasError = !!message.error;

    if (message.method === 'tools/call' && hasId && hasResult && !hasParams && !hasError) {
      // This is a result message (has result but no params and no error)
      const result = message.result as
        | {
            content?: Array<{ type?: string; text?: string }>;
          }
        | undefined;

      if (result?.content && result.content.length > 0) {
        const resultText = result.content[0]?.text || 'Tool execution completed';
        log.debug(`Tool call result received: ${resultText}`);

        // Update progress to mark the most recent incomplete tool as done
        setState((prev) => {
          const messages = [...prev.messages];
          const taskMessageIndex = findTaskMessageIndex(messages);

          if (taskMessageIndex >= 0) {
            const existingMessage = messages[taskMessageIndex];
            const updatedMessage = markProgressLineComplete(existingMessage);

            if (updatedMessage !== existingMessage) {
              const updatedMessages = [...messages];
              updatedMessages[taskMessageIndex] = updatedMessage;

              log.debug(
                `Marked tool call as done. Updated message content: ${updatedMessage.content.substring(0, 100)}`
              );

              return {
                ...prev,
                messages: updatedMessages,
              };
            } else {
              log.warn(
                'Progress line was not updated - message unchanged after markProgressLineComplete'
              );
            }
          } else {
            log.warn(
              `No task message found when trying to mark progress complete. Messages count: ${messages.length}`
            );
          }

          return prev;
        });
      } else {
        log.warn('Tool call result received but result.content is empty or invalid');
      }
    }
  };
}

/**
 * Create handler for tool call errors
 */
export function createToolCallErrorHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>
) {
  return (message: WebSocketMessage) => {
    // Handle tool call errors - mark tool as failed when error is received
    if (message.method === 'tools/call' && message.id && message.error && !message.params) {
      // This is an error message (has error but no params)
      const error = message.error as
        | {
            code?: number;
            message?: string;
          }
        | undefined;

      if (error?.message) {
        const errorText = error.message || 'Tool execution failed';
        log.error(`Tool call error received: ${errorText}`);

        // Update progress to mark the most recent incomplete tool as failed
        setState((prev) => {
          const messages = [...prev.messages];
          const taskMessageIndex = findTaskMessageIndex(messages);

          if (taskMessageIndex >= 0) {
            const existingMessage = messages[taskMessageIndex];

            // Extract tool name from the last incomplete progress line
            const { progressLines } = parseProgressLines(existingMessage.content);
            const lastIncompleteIndex = findLastIncompleteProgressLineIndex(progressLines);

            if (lastIncompleteIndex >= 0) {
              const lastLine = progressLines[lastIncompleteIndex];
              // Extract tool name from progress line (text after ○ or ●✓)
              const toolNameMatch = lastLine.match(/^[○●✓]\s*(.+?)(?:\s*✗|$)/);
              const toolName = toolNameMatch ? toolNameMatch[1].split(' ')[0] : 'tool';

              const updatedMessage = markProgressLineFailed(existingMessage, toolName, errorText);

              if (updatedMessage !== existingMessage) {
                const updatedMessages = [...messages];
                updatedMessages[taskMessageIndex] = updatedMessage;

                log.error(`Marked tool call as failed. Updated line: ${errorText}`);

                return {
                  ...prev,
                  messages: updatedMessages,
                };
              }
            }
          }

          return prev;
        });
      }
    }
  };
}

/**
 * Create handler for task status updates
 */
export function createTaskStatusHandler(
  setState: React.Dispatch<React.SetStateAction<WidgetState>>
) {
  return (message: WebSocketMessage) => {
    // Handle task status updates
    if (message.method === 'task/status' && message.params) {
      const params = message.params as {
        status: string;
        message: string;
        timestamp: string;
      };
      const status = params.status;

      if (status === 'stopped' || status === 'completed' || status === 'failed') {
        setState((prev) => ({
          ...prev,
          activeTaskId: null,
          isTaskRunning: false,
          isLoading: false,
        }));
      }
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
export function createMessageHandler(setState: React.Dispatch<React.SetStateAction<WidgetState>>) {
  const progressHandler = createToolCallProgressHandler(setState);
  const resultHandler = createToolCallResultHandler(setState);
  const errorHandler = createToolCallErrorHandler(setState);
  const taskStatusHandler = createTaskStatusHandler(setState);

  return (message: WebSocketMessage) => {
    log.debug('WebSocket message received:', {
      method: message.method,
      hasId: !!message.id,
      hasParams: !!message.params,
      hasResult: !!message.result,
      hasError: !!message.error,
    });

    // Route to appropriate handler based on message type
    if (message.method === 'tools/call') {
      // Tool call messages can be progress (params), result (result), or error (error)
      const hasParams =
        !!message.params && Object.keys(message.params as Record<string, unknown>).length > 0;
      const hasResult = !!message.result;
      const hasError = !!message.error;

      if (message.id && hasParams) {
        // Progress: tool call with params
        log.debug('Routing to progress handler');
        progressHandler(message);
      } else if (message.id && hasResult && !hasParams && !hasError) {
        // Result: tool call completed successfully
        log.debug('Routing to result handler');
        resultHandler(message);
      } else if (message.id && hasError && !hasParams) {
        // Error: tool call failed
        log.debug('Routing to error handler');
        errorHandler(message);
      } else {
        log.debug('Tool call message did not match any handler conditions', {
          hasId: !!message.id,
          hasParams,
          hasResult,
          hasError,
        });
      }
    } else if (message.method === 'task/status') {
      // Task status updates
      taskStatusHandler(message);
    }
    // Note: Other message types are handled by WebSocketService directly
  };
}

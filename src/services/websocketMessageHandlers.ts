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
  findTaskMessageIndex,
  parseProgressLines,
} from '../utils/messageContentUtils';
import { createPlaceholderMessage } from '../utils/messageFactory';
import {
  addProgressLine,
  markProgressLineComplete,
  markProgressLineFailed,
  updateProgressLine,
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
      log.info('Progress handler: Detected tool call message with params', {
        messageId: message.id,
        params: message.params,
      });
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

        log.info(`Progress handler: Tool call received - ${toolName} - "${progressText}"`, {
          messageId: message.id,
          toolName,
          explanation,
        });

        // Update progress immediately when tool call is received
        setState((prev) => {
          const messages = [...prev.messages];
          const isTaskRunning = prev.isTaskRunning;
          const currentMode = prev.currentMode;

          // Find the message that should receive progress updates
          // Priority order for active show/do tasks:
          // 1. Placeholder message in show/do mode that has content (the "Let me try this" message)
          // 2. Placeholder message in show/do mode (even without content yet)
          // 3. Non-placeholder agent message in show/do mode
          // For other cases:
          // 4. Last placeholder message
          // 5. Last task message
          // 6. Any agent message as fallback
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
                msg.content.trim().length > 0
              ) {
                taskMessageIndex = i;
                log.info('Using active task placeholder with content for progress update', {
                  messageId: msg.id,
                  content: msg.content.substring(0, 50),
                  mode: msg.mode,
                  index: i,
                  totalMessages: messages.length,
                });
                break;
              }
            }

            // Priority 2: Find placeholder in matching mode (even without content)
            if (taskMessageIndex < 0) {
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
                  log.info('Using active task placeholder for progress update', {
                    messageId: msg.id,
                    content: msg.content.substring(0, 50),
                    mode: msg.mode,
                    index: i,
                    totalMessages: messages.length,
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
                  log.info('Using active task message for progress update', {
                    messageId: msg.id,
                    content: msg.content.substring(0, 50),
                    mode: msg.mode,
                    index: i,
                    totalMessages: messages.length,
                  });
                  break;
                }
              }
            }
          }

          // Fallback: If not in active task or no matching message found, use general logic
          if (taskMessageIndex < 0) {
            // Check ALL placeholder messages (not just last one)
            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              if (
                msg.sender === 'agent' &&
                msg.isPlaceholder &&
                !msg.isSystemMessage &&
                !msg.isScreenAccessRequest
              ) {
                taskMessageIndex = i;
                log.info('Using placeholder message for progress update (fallback)', {
                  messageId: msg.id,
                  content: msg.content.substring(0, 50),
                  index: i,
                  totalMessages: messages.length,
                });
                break;
              }
            }
          }

          // If still not found, try to find a task message (non-placeholder agent message)
          if (taskMessageIndex < 0) {
            taskMessageIndex = findTaskMessageIndex(messages);
            if (taskMessageIndex >= 0) {
              log.info('Using task message for progress update (fallback)', {
                messageId: messages[taskMessageIndex].id,
                content: messages[taskMessageIndex].content.substring(0, 50),
                index: taskMessageIndex,
                totalMessages: messages.length,
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
                  content: msg.content.substring(0, 50),
                  isPlaceholder: msg.isPlaceholder,
                  mode: msg.mode,
                  index: i,
                });
                break;
              }
            }
          }

          if (taskMessageIndex >= 0) {
            log.info(`Found message for progress update at index ${taskMessageIndex}`, {
              messageId: messages[taskMessageIndex].id,
              isPlaceholder: messages[taskMessageIndex].isPlaceholder,
              toolName,
              progressText,
              currentContent: messages[taskMessageIndex].content.substring(0, 100),
            });
            const existingMessage = messages[taskMessageIndex];

            // Parse existing content to see current state
            const { mainContent: existingMain, progressLines: existingProgress } =
              parseProgressLines(existingMessage.content);
            log.info('Before adding progress line', {
              messageId: existingMessage.id,
              existingMainContent: existingMain.substring(0, 50),
              existingProgressLines: existingProgress.length,
              existingProgressLinesContent: existingProgress,
            });

            const updatedMessage = addProgressLine(existingMessage, toolName, progressText);

            // Verify the update worked
            const { mainContent: updatedMain, progressLines: updatedProgress } = parseProgressLines(
              updatedMessage.content
            );
            log.info('After adding progress line', {
              messageId: updatedMessage.id,
              updatedMainContent: updatedMain.substring(0, 50),
              updatedProgressLines: updatedProgress.length,
              updatedProgressLinesContent: updatedProgress,
              newProgressLine: updatedProgress[updatedProgress.length - 1],
            });

            const updatedMessages = [...messages];
            updatedMessages[taskMessageIndex] = updatedMessage;

            log.info(`Progress line added successfully`, {
              toolName,
              progressText,
              messageId: updatedMessage.id,
              updatedContent: updatedMessage.content.substring(0, 300),
              hasProgressLines: updatedMessage.content.includes('\n\n'),
              progressLineCount: (updatedMessage.content.match(/\n\n/g) || []).length,
              fullContentLength: updatedMessage.content.length,
            });

            log.info('Progress handler: State update completed', {
              messageId: updatedMessage.id,
              toolName,
              totalMessages: updatedMessages.length,
            });

            return {
              ...prev,
              messages: updatedMessages,
            };
          } else {
            // If no message found, check if we need to create or update a placeholder
            // This handles race conditions where tool calls arrive before React processes state updates
            // ALWAYS check prev.messages (current state) not the stale messages array
            const currentMessages = prev.messages;

            if (currentMessages.length === 0 || taskMessageIndex < 0) {
              // Check if a placeholder already exists in the current state (even if messages array was empty)
              let existingPlaceholderIndex = -1;

              // First, try to find a placeholder matching the current mode
              for (let i = currentMessages.length - 1; i >= 0; i--) {
                const msg = currentMessages[i];
                if (
                  msg.sender === 'agent' &&
                  msg.isPlaceholder &&
                  !msg.isSystemMessage &&
                  !msg.isScreenAccessRequest &&
                  (msg.mode === currentMode || (!msg.mode && currentMode))
                ) {
                  existingPlaceholderIndex = i;
                  log.info('Progress handler: Found existing placeholder in current state', {
                    messageId: msg.id,
                    mode: msg.mode,
                    currentMode,
                    index: i,
                    totalMessages: currentMessages.length,
                  });
                  break;
                }
              }

              // If no mode match, find ANY placeholder
              if (existingPlaceholderIndex < 0) {
                for (let i = currentMessages.length - 1; i >= 0; i--) {
                  const msg = currentMessages[i];
                  if (
                    msg.sender === 'agent' &&
                    msg.isPlaceholder &&
                    !msg.isSystemMessage &&
                    !msg.isScreenAccessRequest
                  ) {
                    existingPlaceholderIndex = i;
                    log.info('Progress handler: Found any placeholder in current state', {
                      messageId: msg.id,
                      mode: msg.mode,
                      currentMode,
                      index: i,
                      totalMessages: currentMessages.length,
                    });
                    break;
                  }
                }
              }

              if (existingPlaceholderIndex >= 0) {
                // Placeholder exists, update it
                const existingPlaceholder = currentMessages[existingPlaceholderIndex];
                const updatedMessage = addProgressLine(existingPlaceholder, toolName, progressText);
                const updatedMessages = [...currentMessages];
                updatedMessages[existingPlaceholderIndex] = updatedMessage;

                log.info('Progress handler: Updated existing placeholder with progress line', {
                  messageId: updatedMessage.id,
                  toolName,
                  progressText,
                  updatedContent: updatedMessage.content.substring(0, 200),
                });

                return {
                  ...prev,
                  messages: updatedMessages,
                };
              } else {
                // No placeholder exists, create a new one
                log.warn('Progress handler: No placeholder found, creating new one on the fly', {
                  toolName,
                  progressText,
                  currentMode,
                  isTaskRunning,
                  currentMessagesCount: currentMessages.length,
                });

                const placeholderMessage = createPlaceholderMessage(currentMode);
                const updatedMessage = addProgressLine(placeholderMessage, toolName, progressText);

                log.info('Progress handler: Created new placeholder and added progress line', {
                  messageId: updatedMessage.id,
                  toolName,
                  progressText,
                  updatedContent: updatedMessage.content.substring(0, 200),
                });

                return {
                  ...prev,
                  messages: [...currentMessages, updatedMessage],
                };
              }
            } else {
              log.error(
                `Progress handler: No task message or placeholder found for progress update! Messages count: ${messages.length}`,
                {
                  messages: messages.map((msg, idx) => ({
                    index: idx,
                    id: msg.id,
                    sender: msg.sender,
                    isPlaceholder: msg.isPlaceholder,
                    isSystemMessage: msg.isSystemMessage,
                    isScreenAccessRequest: msg.isScreenAccessRequest,
                    contentPreview: msg.content.substring(0, 50),
                    mode: msg.mode,
                  })),
                  toolName,
                  progressText,
                }
              );
            }
          }

          return prev;
        });
      } else {
        log.warn('Progress handler: Tool call message missing name', {
          messageId: message.id,
          params,
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
        log.info(`Tool call result received: ${resultText}`, {
          messageId: message.id,
          resultLength: resultText.length,
        });

        // Try to get tool name from pending tool call to match correctly
        let toolName: string | undefined = undefined;
        try {
          const chatId = getStoredChatId();
          if (chatId && message.id !== undefined) {
            const pendingToolCall = getPendingToolCall(chatId);
            // Match by request ID - the pending tool call should have the same requestId as the result message.id
            if (pendingToolCall && pendingToolCall.requestId === message.id) {
              toolName = pendingToolCall.toolName;
              log.info('Matched tool call result to pending tool call', {
                requestId: message.id,
                toolName,
              });
            } else {
              log.debug('Could not match tool call result to pending tool call', {
                requestId: message.id,
                pendingRequestId: pendingToolCall?.requestId,
                pendingToolName: pendingToolCall?.toolName,
              });
            }
          }
        } catch (error) {
          log.debug('Could not get pending tool call for matching', error);
        }

        // Update progress to mark the most recent incomplete tool as done
        setState((prev) => {
          const messages = [...prev.messages];

          // First check if the last message is a placeholder (tool calls often come when message is still a placeholder)
          // Placeholders should receive progress updates
          let taskMessageIndex = -1;
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (
              lastMessage.sender === 'agent' &&
              lastMessage.isPlaceholder &&
              !lastMessage.isSystemMessage &&
              !lastMessage.isScreenAccessRequest
            ) {
              taskMessageIndex = messages.length - 1;
              log.info('Using placeholder message for progress completion');
            }
          }

          // If no placeholder found, try to find a task message (non-placeholder agent message)
          if (taskMessageIndex < 0) {
            taskMessageIndex = findTaskMessageIndex(messages);
            if (taskMessageIndex >= 0) {
              log.info('Using task message for progress completion');
            }
          }

          if (taskMessageIndex >= 0) {
            const existingMessage = messages[taskMessageIndex];

            log.info('Attempting to mark progress complete', {
              messageId: existingMessage.id,
              isPlaceholder: existingMessage.isPlaceholder,
              toolName: toolName || 'last incomplete',
              currentContent: existingMessage.content.substring(0, 200),
              hasProgressLines: existingMessage.content.includes('\n\n'),
            });

            // Try to mark progress complete - if toolName is provided, use it, otherwise mark last incomplete
            let updatedMessage: ChatMessage;
            if (toolName) {
              // Use updateProgressLine to mark specific tool as completed
              updatedMessage = updateProgressLine(existingMessage, toolName, 'completed');
              log.info('Used updateProgressLine with toolName', {
                toolName,
                messageChanged: updatedMessage !== existingMessage,
              });
            } else {
              // Fall back to marking last incomplete progress line
              updatedMessage = markProgressLineComplete(existingMessage);
              log.info('Used markProgressLineComplete (no toolName)', {
                messageChanged: updatedMessage !== existingMessage,
              });
            }

            if (updatedMessage !== existingMessage) {
              const updatedMessages = [...messages];
              updatedMessages[taskMessageIndex] = updatedMessage;

              log.info(`Marked tool call as done successfully`, {
                messageId: updatedMessage.id,
                toolName: toolName || 'last incomplete',
                updatedContent: updatedMessage.content.substring(0, 200),
                hasProgressLines: updatedMessage.content.includes('\n\n'),
                progressLineCount: (updatedMessage.content.match(/\n\n/g) || []).length,
              });

              return {
                ...prev,
                messages: updatedMessages,
              };
            } else {
              log.error('Progress line was not updated - message unchanged', {
                messageId: existingMessage.id,
                messageContent: existingMessage.content.substring(0, 200),
                hasProgressLines: existingMessage.content.includes('\n\n'),
                toolName: toolName || 'last incomplete',
                progressLines: existingMessage.content.includes('\n\n')
                  ? existingMessage.content.split('\n\n').slice(1)
                  : [],
              });
            }
          } else {
            // If no message found and messages array is empty, create a placeholder on the fly
            // This handles race conditions where tool calls arrive before React processes state updates
            if (messages.length === 0) {
              log.warn('Result handler: Messages array is empty, creating placeholder on the fly', {
                requestId: message.id,
                toolName: toolName || 'unknown',
                currentMode: prev.currentMode,
                isTaskRunning: prev.isTaskRunning,
              });
              const placeholderMessage = createPlaceholderMessage(prev.currentMode);
              // If we have a tool name, mark it as completed, otherwise just create the placeholder
              let updatedMessage = placeholderMessage;
              if (toolName) {
                updatedMessage = addProgressLine(placeholderMessage, toolName, '');
                updatedMessage = updateProgressLine(updatedMessage, toolName, 'completed');
              }

              log.info('Result handler: Created placeholder and marked progress complete', {
                messageId: updatedMessage.id,
                toolName: toolName || 'unknown',
                updatedContent: updatedMessage.content.substring(0, 200),
              });

              return {
                ...prev,
                messages: [updatedMessage],
              };
            } else {
              log.error(
                `No task message or placeholder found when trying to mark progress complete! Messages count: ${messages.length}`,
                {
                  messages: messages.map((msg, idx) => ({
                    index: idx,
                    id: msg.id,
                    sender: msg.sender,
                    isPlaceholder: msg.isPlaceholder,
                    isSystemMessage: msg.isSystemMessage,
                    isScreenAccessRequest: msg.isScreenAccessRequest,
                    contentPreview: msg.content.substring(0, 50),
                  })),
                  requestId: message.id,
                }
              );
            }
          }

          return prev;
        });
      } else {
        log.warn('Tool call result received but result.content is empty or invalid', {
          messageId: message.id,
          hasResult: !!message.result,
          resultType: typeof message.result,
        });
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
          const isTaskRunning = prev.isTaskRunning;
          const currentMode = prev.currentMode;

          // Find the message that should receive progress error updates
          // Use same logic as progress handler to ensure consistency
          let taskMessageIndex = -1;

          // For active show/do tasks, find the message that matches the current mode
          if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
            // Priority 1: Find placeholder with content in matching mode
            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              if (
                msg.sender === 'agent' &&
                msg.isPlaceholder &&
                !msg.isSystemMessage &&
                !msg.isScreenAccessRequest &&
                msg.mode === currentMode &&
                msg.content.trim().length > 0
              ) {
                taskMessageIndex = i;
                log.info('Using active task placeholder with content for progress error');
                break;
              }
            }

            // Priority 2: Find placeholder in matching mode
            if (taskMessageIndex < 0) {
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
                  log.info('Using active task placeholder for progress error');
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
                  log.info('Using active task message for progress error');
                  break;
                }
              }
            }
          }

          // Fallback: Try to find a task message (non-placeholder agent message)
          if (taskMessageIndex < 0) {
            taskMessageIndex = findTaskMessageIndex(messages);
          }

          // If no task message found, check if the last message is a placeholder
          if (taskMessageIndex < 0 && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (
              lastMessage.sender === 'agent' &&
              lastMessage.isPlaceholder &&
              !lastMessage.isSystemMessage &&
              !lastMessage.isScreenAccessRequest
            ) {
              taskMessageIndex = messages.length - 1;
              log.info('Using placeholder message for progress error (fallback)');
            }
          }

          if (taskMessageIndex >= 0) {
            const existingMessage = messages[taskMessageIndex];

            // Extract tool name from the last incomplete progress line
            const { progressLines } = parseProgressLines(existingMessage.content);
            const lastIncompleteIndex = findLastIncompleteProgressLineIndex(progressLines);

            if (lastIncompleteIndex >= 0) {
              const lastLine = progressLines[lastIncompleteIndex];
              // Extract tool name from progress line (text after ○ or ●✓)
              // Handle "●✓" as a sequence first
              const toolNameMatch = lastLine.match(/^(?:●✓|○|●|✓)\s*(.+?)(?:\s*✗|$)/);
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
      // Tool call messages can be progress (params with name), result (result), or error (error)
      const params = message.params as
        | {
            name?: string;
            arguments?: Record<string, unknown>;
            mode?: string;
            explanation?: string;
          }
        | undefined;
      // Check if params exists and has a name (indicates progress)
      // params can be undefined, null, empty object, or object with name
      const hasParamsWithName = !!params?.name;
      // Check if params exists as a non-empty object (not undefined, null, or empty)
      const hasParams =
        message.params !== undefined &&
        message.params !== null &&
        typeof message.params === 'object' &&
        Object.keys(message.params as Record<string, unknown>).length > 0;
      const hasResult = !!message.result;
      const hasError = !!message.error;

      log.info('Routing tool call message:', {
        hasId: !!message.id,
        messageId: message.id,
        hasParamsWithName,
        hasParams,
        hasResult,
        hasError,
        paramsType: typeof message.params,
        paramsIsUndefined: message.params === undefined,
        paramsIsNull: message.params === null,
        paramsValue: message.params,
        paramsKeys:
          message.params && typeof message.params === 'object'
            ? Object.keys(message.params as Record<string, unknown>)
            : [],
        toolName: params?.name,
        explanation: params?.explanation,
      });

      if (message.id && hasParamsWithName) {
        // Progress: tool call with params that has a name
        log.info('Routing to progress handler', {
          toolName: params?.name,
          explanation: params?.explanation,
          messageId: message.id,
        });
        progressHandler(message);
      } else if (message.id && hasResult && !hasParams && !hasError) {
        // Result: tool call completed successfully
        // Check !hasParams (not just !hasParamsWithName) to ensure params is truly empty/undefined
        const resultContent = message.result as
          | { content?: Array<{ type?: string; text?: string }> }
          | undefined;
        const resultText = resultContent?.content?.[0]?.text || 'No result text';
        log.info('Routing to result handler', {
          messageId: message.id,
          hasResult,
          hasParams,
          hasError,
          paramsValue: message.params,
          resultText: resultText.substring(0, 100),
        });
        resultHandler(message);
      } else if (message.id && hasError && !hasParams) {
        // Error: tool call failed
        // Check !hasParams to ensure params is truly empty/undefined
        log.debug('Routing to error handler', {
          hasError,
          hasParams,
        });
        errorHandler(message);
      } else {
        log.debug('Tool call message did not match any handler conditions', {
          hasId: !!message.id,
          hasParamsWithName,
          hasParams,
          hasResult,
          hasError,
          paramsType: typeof message.params,
          paramsValue: message.params,
          paramsKeys:
            message.params && typeof message.params === 'object'
              ? Object.keys(message.params as Record<string, unknown>)
              : [],
        });
      }
    } else if (message.method === 'task/status') {
      // Task status updates
      taskStatusHandler(message);
    }
    // Note: Other message types are handled by WebSocketService directly
  };
}

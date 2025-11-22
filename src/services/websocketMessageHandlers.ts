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
    // Entry point logging - confirm handler is being called
    console.log('[ProgressHandler] [ENTRY] createToolCallProgressHandler called', {
      method: message.method,
      hasId: !!message.id,
      messageId: message.id,
      hasParams: !!message.params,
      paramsType: typeof message.params,
      paramsIsNull: message.params === null,
      paramsValue: message.params,
      fullMessage: JSON.stringify(message, null, 2),
    });

    // Handle tool call messages - update progress when tool calls are received
    // Note: Routing already verified hasParamsWithName, so we can be lenient here
    // Check for params existence (could be null/undefined) but routing ensures name exists
    const params = message.params as
      | {
          name?: string;
          arguments?: Record<string, unknown>;
          mode?: string;
          explanation?: string;
        }
      | undefined;

    if (!(message.method === 'tools/call' && message.id && params?.name)) {
      console.log('[ProgressHandler] [ENTRY] Handler called but conditions not met', {
        method: message.method,
        hasId: !!message.id,
        messageId: message.id,
        hasParams: !!message.params,
        paramsName: params?.name,
        willProcess: message.method === 'tools/call' && message.id && params?.name,
      });
      return; // Exit early if conditions not met
    }

    // Process the tool call progress
    const toolName = params.name;
    const explanation = params.explanation || '';
    const progressText = explanation || `Executing ${toolName}...`;

    log.info('Processing tool call progress', {
      toolName,
      progressText,
      messageId: message.id,
      hasParams: !!message.params,
    });

    // Update progress immediately when tool call is received
    setState((prev) => {
      const isTaskRunning = prev.isTaskRunning;
      const currentMode = prev.currentMode;

      log.info('Finding message for progress update', {
        totalMessages: prev.messages.length,
        isTaskRunning,
        currentMode,
        lastMessage: prev.messages[prev.messages.length - 1]
          ? {
              id: prev.messages[prev.messages.length - 1].id,
              isPlaceholder: prev.messages[prev.messages.length - 1].isPlaceholder,
              mode: prev.messages[prev.messages.length - 1].mode,
              content: prev.messages[prev.messages.length - 1].content.substring(0, 100),
              hasProgressLines: prev.messages[prev.messages.length - 1].content.includes('\n\n'),
            }
          : null,
        allMessages: prev.messages.map((msg, idx) => ({
          index: idx,
          id: msg.id,
          isPlaceholder: msg.isPlaceholder,
          mode: msg.mode,
          sender: msg.sender,
          contentPreview: msg.content.substring(0, 50),
        })),
      });

      // Find the message that should receive progress updates
      // Use current state (prev.messages) to avoid stale closure issues
      console.log('[ProgressHandler] [FLOW] Calling findMessageForProgress', {
        totalMessages: prev.messages.length,
        isTaskRunning,
        currentMode,
        lastMessage: prev.messages[prev.messages.length - 1]
          ? {
              id: prev.messages[prev.messages.length - 1].id,
              isPlaceholder: prev.messages[prev.messages.length - 1].isPlaceholder,
              sender: prev.messages[prev.messages.length - 1].sender,
              mode: prev.messages[prev.messages.length - 1].mode,
            }
          : null,
      });
      const foundMessage = findMessageForProgress({
        messages: prev.messages,
        isTaskRunning,
        currentMode,
        preferPlaceholder: true,
        requireContent: false,
      });

      console.log('[ProgressHandler] [FLOW] findMessageForProgress result', {
        found: !!foundMessage,
        index: foundMessage?.index,
        messageId: foundMessage?.message.id,
        isPlaceholder: foundMessage?.message.isPlaceholder,
        content: foundMessage?.message.content.substring(0, 100),
      });

      if (foundMessage) {
        const taskMessageIndex = foundMessage.index;
        const existingMessage = prev.messages[taskMessageIndex];

        // Verify the message exists and is valid
        if (!existingMessage) {
          log.error('Found message index but message is undefined', {
            index: taskMessageIndex,
            totalMessages: prev.messages.length,
          });
          return prev;
        }

        console.log('[ProgressHandler] [FLOW] Adding progress line to existing message', {
          messageId: existingMessage.id,
          messageIndex: taskMessageIndex,
          toolName,
          progressText,
          originalContent: existingMessage.content,
          existingMessageMode: existingMessage.mode,
          currentMode,
        });
        let updatedMessage = addProgressLine(existingMessage, toolName, progressText);

        // CRITICAL: Ensure mode is preserved when updating message
        if (!updatedMessage.mode && existingMessage.mode) {
          updatedMessage = { ...updatedMessage, mode: existingMessage.mode };
          console.log('[ProgressHandler] [FLOW] Preserved message mode', {
            mode: updatedMessage.mode,
          });
        } else if (!updatedMessage.mode && currentMode) {
          updatedMessage = { ...updatedMessage, mode: currentMode };
          console.log('[ProgressHandler] [FLOW] Set message mode from currentMode', {
            mode: updatedMessage.mode,
          });
        }
        console.log('[ProgressHandler] [FLOW] After addProgressLine', {
          updatedContent: updatedMessage.content,
          hasNewline: updatedMessage.content.includes('\n\n'),
        });

        // Update thinking marker after adding progress line
        // For show/do modes: show thinking marker when task is running
        if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
          updatedMessage = updateThinkingMarker(updatedMessage, isTaskRunning, currentMode);
          console.log('[ProgressHandler] [FLOW] After updateThinkingMarker', {
            updatedContent: updatedMessage.content,
          });
        }

        // Verify the progress line was added correctly
        const { progressLines: newProgressLines } = parseProgressLines(updatedMessage.content);
        const hasProgressLine = newProgressLines.some(
          (line) => line.trim().startsWith('○') && line.includes(toolName)
        );

        console.log('[ProgressHandler] [FLOW] Progress line verification', {
          hasProgressLine,
          progressLineCount: newProgressLines.length,
          progressLines: newProgressLines,
          toolName,
        });

        if (!hasProgressLine) {
          console.error('[ProgressHandler] [FLOW] ERROR: Progress line was not added correctly', {
            toolName,
            progressText,
            originalContent: existingMessage.content,
            updatedContent: updatedMessage.content,
            newProgressLines,
            contentIncludesNewline: updatedMessage.content.includes('\n\n'),
          });
          log.error('Progress line was not added correctly', {
            toolName,
            progressText,
            originalContent: existingMessage.content,
            updatedContent: updatedMessage.content,
            newProgressLines,
            contentIncludesNewline: updatedMessage.content.includes('\n\n'),
          });
          // Still return the update - the format might be correct even if check fails
        }

        // Create new messages array with updated message to ensure React re-renders
        // Use spread operator to create new array and new message object
        const updatedMessages = prev.messages.map((msg, idx) =>
          idx === taskMessageIndex ? { ...updatedMessage } : msg
        );

        console.log('[ProgressHandler] [FLOW] SUCCESS: Added progress line to message', {
          messageId: updatedMessage.id,
          messageIndex: taskMessageIndex,
          toolName,
          progressText,
          hasProgressLines: updatedMessage.content.includes('\n\n'),
          progressLineCount: newProgressLines.length,
          contentPreview: updatedMessage.content.substring(0, 200),
          fullContent: updatedMessage.content,
          progressLines: newProgressLines,
          beforeMessageCount: prev.messages.length,
          afterMessageCount: updatedMessages.length,
          updatedMessageContent: updatedMessages[taskMessageIndex].content,
        });
        log.info('SUCCESS: Added progress line to message', {
          messageId: updatedMessage.id,
          messageIndex: taskMessageIndex,
          toolName,
          progressText,
          hasProgressLines: updatedMessage.content.includes('\n\n'),
          progressLineCount: newProgressLines.length,
          contentPreview: updatedMessage.content.substring(0, 200),
          fullContent: updatedMessage.content,
          progressLines: newProgressLines,
        });

        // Verify messages array is a new reference (for React re-render)
        const messagesArrayIsNew = updatedMessages !== prev.messages;
        const updatedMessageIsNew =
          updatedMessages[taskMessageIndex] !== prev.messages[taskMessageIndex];

        console.log('[ProgressHandler] [STATE] Verifying state update structure', {
          messagesArrayIsNew,
          updatedMessageIsNew,
          beforeMessagesLength: prev.messages.length,
          afterMessagesLength: updatedMessages.length,
          beforeMessageContent: prev.messages[taskMessageIndex]?.content,
          afterMessageContent: updatedMessages[taskMessageIndex]?.content,
          contentChanged:
            prev.messages[taskMessageIndex]?.content !== updatedMessages[taskMessageIndex]?.content,
        });

        const newState = {
          ...prev,
          messages: updatedMessages,
        };

        // Verify the updated message has progress lines
        const finalMessage = newState.messages[taskMessageIndex];
        const { progressLines: finalProgressLines } = parseProgressLines(
          finalMessage?.content || ''
        );

        console.log('[ProgressHandler] [STATE] State update complete - calling setState', {
          beforeMessageCount: prev.messages.length,
          afterMessageCount: newState.messages.length,
          updatedMessageIndex: taskMessageIndex,
          updatedMessageId: finalMessage?.id,
          updatedMessageMode: finalMessage?.mode,
          updatedMessageIsPlaceholder: finalMessage?.isPlaceholder,
          updatedMessageContent: finalMessage?.content,
          updatedMessageHasProgress: finalMessage?.content.includes('\n\n'),
          progressLineCount: finalProgressLines.length,
          progressLines: finalProgressLines,
          messagesArrayReference: messagesArrayIsNew
            ? 'NEW (will trigger re-render)'
            : 'SAME (may not trigger re-render)',
          messageReference: updatedMessageIsNew
            ? 'NEW (will trigger re-render)'
            : 'SAME (may not trigger re-render)',
          allMessagesWithProgress: newState.messages
            .map((msg, idx) => {
              const { progressLines } = parseProgressLines(msg.content);
              return {
                index: idx,
                id: msg.id,
                isPlaceholder: msg.isPlaceholder,
                hasProgress: progressLines.length > 0,
                progressCount: progressLines.length,
              };
            })
            .filter((info) => info.hasProgress),
        });
        return newState;
      } else {
        log.warn('No message found for progress update, trying fallback', {
          totalMessages: prev.messages.length,
          isTaskRunning: prev.isTaskRunning,
          currentMode: prev.currentMode,
        });

        // CRITICAL: Before creating new placeholder, check if ANY placeholder exists
        // Search backwards to find the LAST placeholder message
        const currentMessages = prev.messages;
        let existingPlaceholderIndex = -1;
        let existingPlaceholder: ChatMessage | null = null;

        for (let i = currentMessages.length - 1; i >= 0; i--) {
          const msg = currentMessages[i];
          if (
            msg.sender === 'agent' &&
            msg.isPlaceholder &&
            !msg.isSystemMessage &&
            !msg.isScreenAccessRequest
          ) {
            existingPlaceholderIndex = i;
            existingPlaceholder = msg;
            console.log(
              '[ProgressHandler] [FLOW] Found existing placeholder before creating new one',
              {
                index: existingPlaceholderIndex,
                messageId: msg.id,
                mode: msg.mode,
                currentMode,
                content: msg.content.substring(0, 100),
              }
            );
            break;
          }
        }

        // If existing placeholder found, use it instead of creating new one
        if (existingPlaceholder && existingPlaceholderIndex >= 0) {
          console.log(
            '[ProgressHandler] [FLOW] Using existing placeholder instead of creating new one',
            {
              messageId: existingPlaceholder.id,
              index: existingPlaceholderIndex,
            }
          );
          let updatedMessage = addProgressLine(existingPlaceholder, toolName, progressText);

          // CRITICAL: Ensure mode is set correctly
          if (!updatedMessage.mode && currentMode) {
            updatedMessage = { ...updatedMessage, mode: currentMode };
          } else if (existingPlaceholder.mode && !updatedMessage.mode) {
            updatedMessage = { ...updatedMessage, mode: existingPlaceholder.mode };
          }

          // Update thinking marker after adding progress line
          if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
            updatedMessage = updateThinkingMarker(updatedMessage, isTaskRunning, currentMode);
          }

          const updatedMessages = currentMessages.map((msg, idx) =>
            idx === existingPlaceholderIndex ? { ...updatedMessage } : msg
          );

          console.log('[ProgressHandler] [FLOW] Updated existing placeholder with progress', {
            messageId: updatedMessage.id,
            messageIndex: existingPlaceholderIndex,
            toolName,
            progressText,
            contentPreview: updatedMessage.content.substring(0, 200),
            hasProgressLines: updatedMessage.content.includes('\n\n'),
          });

          return {
            ...prev,
            messages: updatedMessages,
          };
        }

        // Try finding message again with current state (retry logic)
        const retryFoundMessage = findMessageForProgress({
          messages: currentMessages,
          isTaskRunning,
          currentMode,
          preferPlaceholder: true,
          requireContent: false,
        });

        if (retryFoundMessage) {
          const taskMessageIndex = retryFoundMessage.index;
          const existingMessage = currentMessages[taskMessageIndex];
          if (!existingMessage) {
            log.error('Retry found message but message is undefined', {
              index: taskMessageIndex,
              totalMessages: currentMessages.length,
            });
            return prev;
          }
          let updatedMessage = addProgressLine(existingMessage, toolName, progressText);
          // Update thinking marker after adding progress line
          if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
            updatedMessage = updateThinkingMarker(updatedMessage, isTaskRunning, currentMode);
          }
          const updatedMessages = currentMessages.map((msg, idx) =>
            idx === taskMessageIndex ? { ...updatedMessage } : msg
          );
          log.info('SUCCESS: Added progress line via retry', {
            messageId: updatedMessage.id,
            messageIndex: taskMessageIndex,
            toolName,
            progressText,
            contentPreview: updatedMessage.content.substring(0, 200),
            hasProgressLines: updatedMessage.content.includes('\n\n'),
          });
          return {
            ...prev,
            messages: updatedMessages,
          };
        }

        // No placeholder exists at all, create a new one
        // This should be rare - we should have found an existing placeholder above
        console.warn(
          '[ProgressHandler] [FLOW] Creating new placeholder message for progress update',
          {
            toolName,
            progressText,
            currentMode,
            totalMessages: currentMessages.length,
            isTaskRunning,
          }
        );
        log.warn('Creating new placeholder message for progress update', {
          toolName,
          progressText,
          currentMode,
          totalMessages: currentMessages.length,
        });
        const placeholderMessage = createPlaceholderMessage(currentMode);
        let updatedMessage = addProgressLine(placeholderMessage, toolName, progressText);
        // CRITICAL: Ensure mode is set (should already be set from createPlaceholderMessage, but double-check)
        if (!updatedMessage.mode && currentMode) {
          updatedMessage = { ...updatedMessage, mode: currentMode };
        }
        // Update thinking marker after adding progress line
        if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
          updatedMessage = updateThinkingMarker(updatedMessage, isTaskRunning, currentMode);
        }

        // Verify progress line was added
        const { progressLines: verifyProgressLines } = parseProgressLines(updatedMessage.content);
        console.log('[ProgressHandler] [FLOW] Created new placeholder with progress', {
          messageId: updatedMessage.id,
          toolName,
          progressText,
          contentPreview: updatedMessage.content.substring(0, 200),
          fullContent: updatedMessage.content,
          hasProgressLines: updatedMessage.content.includes('\n\n'),
          progressLineCount: verifyProgressLines.length,
          progressLines: verifyProgressLines,
        });
        log.info('SUCCESS: Created new placeholder with progress line', {
          messageId: updatedMessage.id,
          toolName,
          progressText,
          contentPreview: updatedMessage.content.substring(0, 200),
          hasProgressLines: updatedMessage.content.includes('\n\n'),
        });

        const newMessages = [...currentMessages, { ...updatedMessage }];
        console.log('[ProgressHandler] [FLOW] Returning state with new message', {
          oldMessageCount: currentMessages.length,
          newMessageCount: newMessages.length,
          lastMessageId: newMessages[newMessages.length - 1].id,
          lastMessageContent: newMessages[newMessages.length - 1].content,
        });
        return {
          ...prev,
          messages: newMessages,
        };
      }
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

        // Update progress to mark the most recent incomplete tool as done
        setState((prev) => {
          const messages = [...prev.messages];
          const isTaskRunning = prev.isTaskRunning;
          const currentMode = prev.currentMode;

          // Find the message that should receive progress completion using centralized utility
          const foundMessage = findMessageForProgress({
            messages,
            isTaskRunning,
            currentMode,
            preferPlaceholder: true,
          });

          if (foundMessage) {
            const taskMessageIndex = foundMessage.index;
            const existingMessage = messages[taskMessageIndex];

            const updatedMessage = toolName
              ? updateProgressLine(existingMessage, toolName, 'completed')
              : markProgressLineComplete(existingMessage);

            if (updatedMessage !== existingMessage) {
              const updatedMessages = [...messages];
              updatedMessages[taskMessageIndex] = updatedMessage;
              return {
                ...prev,
                messages: updatedMessages,
              };
            }
          } else {
            // If no message found and messages array is empty, create a placeholder on the fly
            if (messages.length === 0) {
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
          }

          return prev;
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

        // Update progress to mark the most recent incomplete tool as failed
        setState((prev) => {
          const messages = [...prev.messages];
          const isTaskRunning = prev.isTaskRunning;
          const currentMode = prev.currentMode;

          // Find the message that should receive progress error updates using centralized utility
          const foundMessage = findMessageForProgress({
            messages,
            isTaskRunning,
            currentMode,
            preferPlaceholder: true,
            requireContent: true,
          });

          if (foundMessage) {
            const taskMessageIndex = foundMessage.index;
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
        message?: string;
        timestamp?: string;
        task_id?: string;
      };
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
        setState((prev) => {
          // Update messages: remove thinking markers and convert placeholders to regular messages
          const updatedMessages = prev.messages.map((msg) => {
            // Remove thinking marker from content
            const contentWithoutThinking = msg.content
              .replace(/\n\n__THINKING__$/, '')
              .replace(/__THINKING__/g, '');

            // If this is a placeholder message, convert it to a regular message
            if (msg.isPlaceholder) {
              return {
                ...msg,
                content: contentWithoutThinking,
                isPlaceholder: false,
                placeholderState: undefined,
              };
            }

            // For regular messages, just remove thinking marker
            if (contentWithoutThinking !== msg.content) {
              return {
                ...msg,
                content: contentWithoutThinking,
              };
            }

            return msg;
          });

          // Add completion/failure message if status message is provided
          let finalMessages = updatedMessages;
          if (statusMessage && statusMessage.trim().length > 0) {
            const completionMessage = createSystemMessage(statusMessage);
            finalMessages = [...updatedMessages, completionMessage];
          }

          return {
            ...prev,
            activeTaskId: null,
            isTaskRunning: false,
            isLoading: false,
            messages: finalMessages,
          };
        });
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
    console.log('[MessageHandler] [FLOW] WebSocket message received in createMessageHandler', {
      method: message.method,
      hasId: !!message.id,
      messageId: message.id,
      hasParams: !!message.params,
      hasResult: !!message.result,
      hasError: !!message.error,
      paramsType: typeof message.params,
      paramsValue: message.params,
    });
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

      // Detailed routing verification logging
      console.log('[MessageHandler] [ROUTING] Verifying routing conditions:', {
        method: message.method,
        hasId: !!message.id,
        messageId: message.id,
        hasParamsWithName,
        hasParams,
        hasResult,
        hasError,
        paramsType: typeof message.params,
        paramsIsUndefined: message.params === undefined,
        paramsIsNull: message.params === null,
        paramsIsEmptyObject:
          message.params !== null &&
          typeof message.params === 'object' &&
          Object.keys(message.params as Record<string, unknown>).length === 0,
        paramsValue: message.params,
        paramsKeys:
          message.params && typeof message.params === 'object'
            ? Object.keys(message.params as Record<string, unknown>)
            : [],
        toolName: params?.name,
        toolNameType: typeof params?.name,
        explanation: params?.explanation,
        mode: params?.mode,
        arguments: params?.arguments,
        routingDecision: {
          willRouteToProgress: message.id && hasParamsWithName,
          willRouteToResult: message.id && hasResult && !hasParams && !hasError,
          willRouteToError: message.id && hasError && !hasParams,
          willNotRoute:
            !(message.id && hasParamsWithName) &&
            !(message.id && hasResult && !hasParams && !hasError) &&
            !(message.id && hasError && !hasParams),
        },
      });

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
        console.log('[MessageHandler] [FLOW] Routing to progress handler', {
          toolName: params?.name,
          explanation: params?.explanation,
          messageId: message.id,
          hasParamsWithName,
          hasParams,
          hasResult,
          hasError,
        });
        log.info('Routing to progress handler', {
          toolName: params?.name,
          explanation: params?.explanation,
          messageId: message.id,
        });
        try {
          progressHandler(message);
          console.log('[MessageHandler] [FLOW] Progress handler completed');
        } catch (error) {
          console.error('[MessageHandler] [FLOW] Error in progress handler:', error);
        }
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

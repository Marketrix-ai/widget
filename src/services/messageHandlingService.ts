/**
 * Message Handling Service
 *
 * Unified message handling for tell/show/do modes.
 * Consolidates duplicate logic and provides clean interface for sending messages.
 */

import type {
  ChatMessage,
  InstructionType,
  MarketrixConfig,
  SendMessageResponse,
  WidgetState,
} from '../types';
import { initializationState } from '../utils/initializationState';
import { createLogger } from '../utils/logger';
import { parseProgressLines, reconstructMessageContent } from '../utils/messageContentUtils';
import {
  createAgentMessage,
  createErrorMessage,
  createPlaceholderMessage,
  createUserMessage,
} from '../utils/messageFactory';
import MarketrixApiService from './marketrixApiService';

const log = createLogger('MessageHandling');

interface SendMessageParams {
  content: string;
  mode?: InstructionType;
  connectionId?: number;
  question?: string;
  skipUserMessage?: boolean;
}

interface MessageHandlingContext {
  state: WidgetState;
  setState: React.Dispatch<React.SetStateAction<WidgetState>>;
  config: MarketrixConfig;
  apiService: MarketrixApiService;
  activeMessageRef: React.MutableRefObject<ChatMessage | null>;
  initializeChatSession: () => Promise<void>;
}

/**
 * Extract user-friendly error message from error
 */
function extractUserFriendlyError(error: unknown): string {
  let userFriendlyError = 'Sorry, I encountered an error. Please try again.';
  const errorMsg = error instanceof Error ? error.message : String(error);

  // If error contains API error details, use them
  if (errorMsg.includes('API returned status')) {
    // Extract the actual error message after the status
    // Format: "API returned status 500. No tell-mode rule found!"
    const apiErrorMatch = errorMsg.match(/API returned status \d+\. (.+?)(?:\.|$)/);
    if (apiErrorMatch && apiErrorMatch.length > 1) {
      const apiError = apiErrorMatch[1].trim();
      // Make it more user-friendly
      if (apiError.includes('No tell-mode rule found')) {
        userFriendlyError = 'Sorry, the tell mode is not configured. Please contact support.';
      } else if (apiError.includes('No show-mode rule found')) {
        userFriendlyError = 'Sorry, the show mode is not configured. Please contact support.';
      } else if (apiError.includes('No do-mode rule found')) {
        userFriendlyError = 'Sorry, the do mode is not configured. Please contact support.';
      } else {
        userFriendlyError = `Sorry, ${apiError.toLowerCase()}`;
      }
    }
  } else if (errorMsg.includes('API request failed')) {
    // Extract the actual error from "API request failed: <error>"
    const actualError = errorMsg.replace('API request failed: ', '').trim();
    if (actualError) {
      userFriendlyError = `Sorry, ${actualError.toLowerCase()}`;
    }
  }

  return userFriendlyError;
}

/**
 * Handle initialization errors
 */
function handleInitializationError(
  context: MessageHandlingContext,
  placeholderMessageId: string,
  messageMode: InstructionType,
  messageId: string
): void {
  const { setState, activeMessageRef } = context;
  activeMessageRef.current = null;
  setState((prev) => {
    const newMessages = prev.messages.filter((msg) => msg.id !== placeholderMessageId);
    const errorMessage = createErrorMessage(
      'Failed to initialize chat. Please try again.',
      messageMode,
      messageId
    );
    return {
      ...prev,
      messages: [...newMessages, errorMessage],
      isLoading: false,
    };
  });
}

/**
 * Handle task mode response (show/do)
 */
function handleTaskModeResponse(
  context: MessageHandlingContext,
  response: SendMessageResponse,
  placeholderMessageId: string,
  messageMode: InstructionType,
  taskId: string | null
): void {
  const { setState, activeMessageRef } = context;
  const agentMessage = createAgentMessage(response.response, response.mode, response.messageId);

  // Override timestamp from API response if provided
  if (response.timestamp) {
    agentMessage.timestamp = response.timestamp;
  }

  log.debug(`Adding agent message: "${agentMessage.content}" (id: ${agentMessage.id})`);

  setState((prev) => {
    const placeholderMsg = prev.messages.find((msg) => msg.id === placeholderMessageId);
    if (placeholderMsg) {
      // Update placeholder with agent message content, preserving any existing progress lines
      const existingContent = placeholderMsg.content || '';
      const { progressLines } = parseProgressLines(existingContent);

      // Use agent message content as main content, keep existing progress lines
      const updatedContent = reconstructMessageContent(agentMessage.content, progressLines);

      const updatedMessages = prev.messages.map((msg) =>
        msg.id === placeholderMessageId
          ? {
              ...msg,
              content: updatedContent,
              mode: msg.mode || messageMode, // Preserve mode or set from messageMode
              // Keep as placeholder so tool calls can update it
            }
          : msg
      );

      // Update active message ref to point to the updated placeholder
      const updatedPlaceholder = updatedMessages.find((msg) => msg.id === placeholderMessageId);
      if (updatedPlaceholder) {
        activeMessageRef.current = updatedPlaceholder;
      }

      log.debug(
        `Updated placeholder with agent message content. Message count: ${updatedMessages.length}`
      );

      return {
        ...prev,
        messages: updatedMessages,
        isLoading: false,
        // Set task state for show/do modes
        ...(taskId
          ? {
              activeTaskId: taskId,
              isTaskRunning: true,
              taskProgress: [],
            }
          : {}),
      };
    }

    // Fallback: if placeholder not found, replace it
    const newMessages = prev.messages.map((msg) =>
      msg.id === placeholderMessageId ? agentMessage : msg
    );
    // Update active message ref to point to the agent message
    activeMessageRef.current = agentMessage;
    return {
      ...prev,
      messages: newMessages,
      isLoading: false,
      ...(taskId
        ? {
            activeTaskId: taskId,
            isTaskRunning: true,
            taskProgress: [],
          }
        : {}),
    };
  });
}

/**
 * Handle tell mode response
 */
function handleTellModeResponse(
  context: MessageHandlingContext,
  response: SendMessageResponse,
  placeholderMessageId: string
): void {
  const { setState, activeMessageRef } = context;
  const agentMessage = createAgentMessage(response.response, response.mode, response.messageId);

  // Override timestamp from API response if provided
  if (response.timestamp) {
    agentMessage.timestamp = response.timestamp;
  }

  setState((prev) => {
    const placeholderMsg = prev.messages.find((msg) => msg.id === placeholderMessageId);
    let finalAgentMessage = agentMessage;

    // If placeholder has progress lines (content with \n\n), preserve them
    if (placeholderMsg?.content.includes('\n\n')) {
      const parts = placeholderMsg.content.split('\n\n');
      if (parts.length > 1) {
        const progressLines = parts.slice(1);
        finalAgentMessage = {
          ...agentMessage,
          content: [agentMessage.content, ...progressLines].join('\n\n'),
        };
      }
    }

    // Update active message ref to point to the agent message
    activeMessageRef.current = finalAgentMessage;

    const newMessages = prev.messages.map((msg) =>
      msg.id === placeholderMessageId ? finalAgentMessage : msg
    );
    log.debug(
      `State updated with ${newMessages.length} messages. Last message: "${newMessages[newMessages.length - 1].content}"`
    );
    return {
      ...prev,
      messages: newMessages,
      isLoading: false,
    };
  });
}

/**
 * Send a message to the agent
 */
export async function sendMessage(
  params: SendMessageParams,
  context: MessageHandlingContext
): Promise<void> {
  const { content, mode, connectionId, question, skipUserMessage = false } = params;

  if (!content.trim()) {
    log.warn('Attempted to send empty message');
    return;
  }

  const messageMode = mode || context.state.currentMode;
  const messageId = Date.now().toString();

  // Create placeholder message for thinking state
  const placeholderMessage = createPlaceholderMessage(messageMode);
  const placeholderMessageId = placeholderMessage.id;

  // Set active message ref to track which message should receive progress updates
  context.activeMessageRef.current = placeholderMessage;

  // Only add user message if it wasn't already added (e.g., from chip click)
  if (!skipUserMessage) {
    const userMessage = createUserMessage(content, messageMode);

    // Add user message and placeholder immediately for immediate feedback
    context.setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage, placeholderMessage],
      isLoading: true,
    }));
  } else {
    // Message already added, just add placeholder and set loading state
    context.setState((prev) => ({
      ...prev,
      messages: [...prev.messages, placeholderMessage],
      isLoading: true,
    }));
  }

  // Ensure API service is initialized
  if (!context.apiService) {
    log.warn('API service not initialized, initializing now...');
    context.apiService = new MarketrixApiService(context.config);
  }

  // Ensure chat session is initialized
  if (!initializationState.getComplete() || !initializationState.getChatId()) {
    log.info('Chat session not initialized, initializing now...');
    try {
      await context.initializeChatSession();
    } catch (initError) {
      log.error('Failed to initialize chat session:', initError);
      handleInitializationError(context, placeholderMessageId, messageMode, messageId);
      return;
    }
  }

  // Double-check after initialization
  if (!context.apiService) {
    log.error('Failed to initialize API service');
    handleInitializationError(context, placeholderMessageId, messageMode, messageId);
    return;
  }

  // Ensure chat ID is available
  let chatId: string;
  try {
    chatId = await context.apiService.getOrCreateChatId();
    if (!chatId) {
      throw new Error('Failed to get or create chat ID');
    }
  } catch (chatIdError) {
    log.error('Failed to get or create chat ID:', chatIdError);
    handleInitializationError(context, placeholderMessageId, messageMode, messageId);
    return;
  }

  try {
    const response = await context.apiService.sendMessage({
      message: content.trim(),
      mode: messageMode,
      connection_id: connectionId,
      question,
    });

    // For show/do modes, check if task_id is in response and start tracking
    const isTaskMode = messageMode === 'show' || messageMode === 'do';
    let taskId: string | null = null;

    // Try to extract task_id from response if available
    if (isTaskMode && response && 'task_id' in response && typeof response.task_id === 'string') {
      taskId = response.task_id;
    }

    // For show/do modes, log the task start
    if (isTaskMode) {
      log.debug(`Task started: ${response.response}`);
    }

    // Handle response based on mode
    if (isTaskMode) {
      handleTaskModeResponse(context, response, placeholderMessageId, messageMode, taskId);
    } else {
      handleTellModeResponse(context, response, placeholderMessageId);
    }
  } catch (error) {
    log.error('Failed to send message:', error);

    const userFriendlyError = extractUserFriendlyError(error);
    const errorMessage = createErrorMessage(userFriendlyError, messageMode, messageId);

    // Clear active message ref on error
    context.activeMessageRef.current = null;

    // Remove placeholder message on error
    context.setState((prev) => {
      const newMessages = prev.messages.filter(
        (msg) => !(msg.isPlaceholder && msg.id.startsWith('placeholder-'))
      );
      return {
        ...prev,
        messages: [...newMessages, errorMessage],
        isLoading: false,
        error: 'Failed to send message',
      };
    });
  }
}

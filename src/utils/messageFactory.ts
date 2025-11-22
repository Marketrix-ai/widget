import type { ChatMessage, InstructionType } from '../types';

/**
 * Generate a unique message ID with optional prefix
 */
function generateMessageId(prefix?: string): string {
  const timestamp = Date.now();
  return prefix ? `${prefix}-${timestamp}` : timestamp.toString();
}

/**
 * Get current timestamp
 * Centralized for potential future mocking in tests
 */
function getCurrentTimestamp(): Date {
  return new Date();
}

/**
 * Create a user message
 */
export function createUserMessage(
  content: string,
  mode?: InstructionType,
  idPrefix: string = 'user-message'
): ChatMessage {
  return {
    id: generateMessageId(idPrefix),
    content: content.trim(),
    sender: 'user',
    timestamp: getCurrentTimestamp(),
    mode,
  };
}

/**
 * Create an agent message
 * Supports both API-provided messageId and auto-generated IDs
 */
export function createAgentMessage(
  content: string,
  mode?: InstructionType,
  messageId?: string,
  idPrefix: string = 'agent-message'
): ChatMessage {
  return {
    id: messageId || generateMessageId(idPrefix),
    content,
    sender: 'agent',
    timestamp: getCurrentTimestamp(),
    mode,
  };
}

/**
 * Create a placeholder message for loading state
 */
export function createPlaceholderMessage(
  mode?: InstructionType,
  placeholderState: 'thinking' | 'waiting-for-user' = 'thinking'
): ChatMessage {
  return {
    id: generateMessageId('placeholder'),
    content: '', // Empty content, will show progress bar
    sender: 'agent',
    timestamp: getCurrentTimestamp(),
    mode,
    isPlaceholder: true,
    placeholderState,
  };
}

/**
 * Create a system message
 */
export function createSystemMessage(
  content: string,
  mode?: InstructionType,
  sender: 'user' | 'agent' = 'agent',
  idPrefix: string = 'system-message'
): ChatMessage {
  return {
    id: generateMessageId(idPrefix),
    content,
    sender,
    timestamp: getCurrentTimestamp(),
    mode,
    isSystemMessage: true,
  };
}

/**
 * Create a screen access request message
 */
export function createScreenAccessRequestMessage(mode?: InstructionType): ChatMessage {
  return {
    id: generateMessageId('screen-access-request'),
    content: 'Can I take a look at your screen?',
    sender: 'agent',
    timestamp: getCurrentTimestamp(),
    mode,
    isScreenAccessRequest: true,
  };
}

/**
 * Create a muted "started screenshare" system message
 */
export function createStartedScreenshareMessage(mode: InstructionType = 'show'): ChatMessage {
  return {
    id: generateMessageId('started-screenshare'),
    content: 'Started screenshare',
    sender: 'user',
    timestamp: getCurrentTimestamp(),
    mode,
    isSystemMessage: true,
  };
}

/**
 * Create a screenshare message with video stream (no text content)
 */
export function createScreenshareMessage(
  stream: MediaStream,
  mode: InstructionType = 'show'
): ChatMessage {
  return {
    id: generateMessageId('screenshare'),
    content: '', // Empty content, only video stream
    sender: 'user',
    timestamp: getCurrentTimestamp(),
    mode,
    videoStream: stream,
  };
}

/**
 * Create an error message from the agent
 */
export function createErrorMessage(
  content: string,
  mode?: InstructionType,
  originalMessageId?: string
): ChatMessage {
  return {
    id: generateMessageId(originalMessageId ? `error-${originalMessageId}` : 'error'),
    content,
    sender: 'agent',
    timestamp: getCurrentTimestamp(),
    mode,
  };
}

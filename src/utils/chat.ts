/**
 * Message Content Utilities
 *
 * Centralized utilities for message content transformation, including:
 * - Removing thinking markers
 */

import type { ChatMessage, InstructionType } from '../types';
import { BROWSER_TOOLS } from '../types/browserTools';

/**
 * Remove all __THINKING__ markers from message content
 */
export function removeThinkingMarkers(content: string): string {
  return content.replace(/__THINKING__/g, '');
}

/**
 * Remove thinking marker from end of content (for display)
 */
export function removeThinkingMarkerFromEnd(content: string): string {
  return content.replace(/\n\n__THINKING__$/, '').replace(/__THINKING__/g, '');
}

/**
 * Check if content has thinking marker
 */
export function hasThinkingMarker(content: string): boolean {
  return content.includes('__THINKING__');
}

/**
 * Add thinking marker to content
 */
export function addThinkingMarker(content: string): string {
  if (hasThinkingMarker(content)) return content;
  return `${content}\n\n__THINKING__`;
}

/**
 * Find the index of the last task message (agent message that's not system/placeholder/screen access)
 */
export function findTaskMessageIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest && !msg.isPlaceholder) {
      return i;
    }
  }
  return -1;
}
/**
 * Message Finder Utility
 *
 * Centralized logic for finding messages in the chat that should receive
 * progress updates, tool call results, or errors. Eliminates duplicate
 * message finding code across stream handlers.
 */

// import type { InstructionType } from '../types';
// Remove self import
// // import { findTaskMessageIndex } from './messageContentUtils';

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
  checkMode: boolean,
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
    const hasProgress = msg.parts && msg.parts.length > 0;
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
  let taskMessageIndex = -1;

  // For active show/do tasks, find the message that matches the current mode and task state
  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    const checkMode = true;

    // Priority 1: Find LAST placeholder with content in matching mode
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const matchesCriteria = matchesProgressCriteria(
        msg,
        isTaskRunning,
        currentMode,
        preferPlaceholder,
        requireContent,
        checkMode,
      );
      const isPlaceholder = msg.isPlaceholder;
      const hasContent = !requireContent || msg.content.trim().length > 0 || (msg.parts && msg.parts.length > 0);

      if (matchesCriteria && isPlaceholder && hasContent) {
        taskMessageIndex = i;
        break;
      }
    }

    // Priority 2: Find LAST placeholder in matching mode (even without content)
    if (taskMessageIndex < 0 && !requireContent) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const matchesCriteria = matchesProgressCriteria(
          msg,
          isTaskRunning,
          currentMode,
          preferPlaceholder,
          requireContent,
          checkMode,
        );
        const isPlaceholder = msg.isPlaceholder;

        if (matchesCriteria && isPlaceholder) {
          taskMessageIndex = i;
          break;
        }
      }
    }

    // Priority 3: Find LAST non-placeholder agent message in matching mode
    if (taskMessageIndex < 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const matchesCriteria = matchesProgressCriteria(
          msg,
          isTaskRunning,
          currentMode,
          preferPlaceholder,
          requireContent,
          checkMode,
        );
        const isPlaceholder = msg.isPlaceholder;

        if (matchesCriteria && !isPlaceholder) {
          taskMessageIndex = i;
          break;
        }
      }
    }
  }

  // Fallback: If not in active task or no matching message found, use general logic
  // This is critical - tool calls can arrive before isTaskRunning is set to true
  if (taskMessageIndex < 0) {
    // Priority 1: Check LAST placeholder message (preferred for progress updates)
    // Don't require mode matching or content when task isn't running yet
    // ALWAYS check for placeholders first, regardless of preferPlaceholder flag
    // This ensures we find existing placeholders before creating new ones
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const isAgent = msg.sender === 'agent';
      const isPlaceholder = msg.isPlaceholder;
      const notSystem = !msg.isSystemMessage;
      const notScreenAccess = !msg.isScreenAccessRequest;
      const hasContent = !requireContent || msg.content.trim().length > 0 || (msg.parts && msg.parts.length > 0);

      if (isAgent && isPlaceholder && notSystem && notScreenAccess && hasContent) {
        taskMessageIndex = i;
        break;
      }
    }

    // Priority 2: If still not found, try placeholder without content requirement
    if (taskMessageIndex < 0 && !requireContent) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.sender === 'agent' && msg.isPlaceholder && !msg.isSystemMessage && !msg.isScreenAccessRequest) {
          taskMessageIndex = i;
          break;
        }
      }
    }

    // Priority 3: Try to find the last task message (non-placeholder agent message)
    if (taskMessageIndex < 0) {
      taskMessageIndex = findTaskMessageIndex(messages);
    }

    // Priority 4: Last resort - find ANY agent message (ensures we always find something if possible)
    if (taskMessageIndex < 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest) {
          taskMessageIndex = i;
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

  console.warn('[MessageFinder] No message found for progress update', {
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
  currentMode?: InstructionType,
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
    if (msg.sender === 'agent' && msg.isPlaceholder && !msg.isSystemMessage && !msg.isScreenAccessRequest) {
      return { index: i, message: msg };
    }
  }

  return null;
}

/**
 * Ensure message has initialized parts
 */
function ensureMessageStructure(message: ChatMessage): ChatMessage {
  const msg = { ...message };

  // Ensure parts exist
  if (!msg.parts) {
    msg.parts = [];

    // Check if content needs to be treated as a text part
    const cleanContent = msg.content.replace(/\n\n__THINKING__$/, '').trim();
    if (cleanContent) {
      msg.parts.push({
        type: 'text',
        content: cleanContent,
      });
    }
  }

  return msg;
}

/**
 * Tools that should show an icon and standard text style.
 * These are "mouse and keyboard" interactions.
 * All other tools will have hidden icons and muted text.
 */
const INTERACTIVE_TOOLS = new Set([
  'click_element',
  'type_text',
  'send_keys',
  'select_dropdown_option',
  'upload_file',
  'scroll',
]);

/**
 * Remove "(Cancelled by cleanup)" and similar cancellation messages from content
 * This filters out expected cancellation messages that shouldn't be shown to users
 */
function filterCancellationText(content: string): string {
  if (!content) return content;
  // Remove "(Cancelled by cleanup)" in various forms
  return content
    .replace(/\(Cancelled by cleanup\)/gi, '')
    .replace(/\(cancelled by cleanup\)/gi, '')
    .replace(/Cancelled by cleanup/gi, '')
    .replace(/\s+/g, ' ') // Clean up multiple spaces
    .trim();
}

/**
 * Add a new progress step to a message
 */
export function addProgressLine(message: ChatMessage, toolName: string, explanation: string): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  const existingPartIndex = parts.findIndex(
    part => part.type === 'progress' && part.toolName === toolName && part.status === 'in_progress',
  );

  const isInteractive = INTERACTIVE_TOOLS.has(toolName);
  const hideIcon = !isInteractive;
  const textStyle = 'default';

  // Filter cancellation text from explanation
  const cleanedExplanation = filterCancellationText(explanation);

  if (existingPartIndex >= 0) {
    newParts[existingPartIndex] = {
      ...newParts[existingPartIndex],
      content: cleanedExplanation,
      hideIcon,
      textStyle,
    };
  } else {
    newParts.push({
      type: 'progress',
      content: cleanedExplanation,
      status: 'in_progress',
      toolName,
      hideIcon,
      textStyle,
    });
  }

  return {
    ...msg,
    parts: newParts,
  };
}

/**
 * Update an existing progress step for a tool
 */
export function updateProgressLine(
  message: ChatMessage,
  toolName: string,
  status: 'pending' | 'completed' | 'failed',
  error?: string,
): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  const partIndex = parts.map(p => (p.type === 'progress' ? p.toolName : '')).lastIndexOf(toolName);

  const mappedStatus = status === 'pending' ? 'in_progress' : status;

  const isInteractive = INTERACTIVE_TOOLS.has(toolName);
  const hideIcon = !isInteractive;
  const textStyle = 'default';

  if (partIndex >= 0) {
    newParts[partIndex] = {
      ...newParts[partIndex],
      status: mappedStatus,
      hideIcon,
      textStyle,
    };

    if (status === 'failed' && error) {
      newParts[partIndex] = {
        ...newParts[partIndex],
        content: `${newParts[partIndex].content} (${error})`,
      };
    }
  } else {
    newParts.push({
      type: 'progress',
      content: `${getFriendlyToolName(toolName)}...`,
      status: mappedStatus,
      toolName,
      hideIcon,
      textStyle,
    });
  }

  return { ...msg, parts: newParts };
}

/**
 * Mark the last incomplete progress step as completed
 */
export function markProgressLineComplete(message: ChatMessage, toolName?: string): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  let partIndex = -1;
  if (toolName) {
    partIndex = parts.map(p => (p.type === 'progress' ? p.toolName : '')).lastIndexOf(toolName);
  } else {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'progress' && parts[i].status === 'in_progress') {
        partIndex = i;
        break;
      }
    }
  }

  if (partIndex >= 0) {
    newParts[partIndex] = { ...newParts[partIndex], status: 'completed' };
  }

  return { ...msg, parts: newParts };
}

/**
 * Mark the last incomplete progress step as failed
 */
export function markProgressLineFailed(message: ChatMessage, toolName: string, error: string): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Filter out "Cancelled by cleanup" errors - these are expected in show mode
  // when a new action starts before the previous one completes
  const shouldFilterError = error.toLowerCase().includes('cancelled by cleanup');

  // Update Parts
  const newParts = [...parts];
  let partIndex = parts.map(p => (p.type === 'progress' ? p.toolName : '')).lastIndexOf(toolName);
  if (partIndex === -1) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'progress' && parts[i].status === 'in_progress') {
        partIndex = i;
        break;
      }
    }
  }

  if (partIndex >= 0) {
    // If error should be filtered, just mark as completed instead of failed
    // This prevents showing confusing "Cancelled by cleanup" messages to users
    if (shouldFilterError) {
      // Clean any cancellation text from content and mark as completed
      const cleanedContent = filterCancellationText(newParts[partIndex].content);
      newParts[partIndex] = {
        ...newParts[partIndex],
        status: 'completed',
        content: cleanedContent,
      };
    } else {
      // Filter cancellation text from error before appending
      const cleanedError = filterCancellationText(error);
      const cleanedContent = filterCancellationText(newParts[partIndex].content);
      newParts[partIndex] = {
        ...newParts[partIndex],
        status: 'failed',
        content: cleanedError ? `${cleanedContent} (${cleanedError})` : cleanedContent,
      };
    }
  }

  return { ...msg, parts: newParts };
}

/**
 * Add or remove thinking marker based on task state
 */
export function updateThinkingMarker(
  message: ChatMessage,
  isTaskRunning: boolean,
  currentMode: 'show' | 'tell' | 'do',
  isWaitingForUser: boolean = false,
): ChatMessage {
  const msg = ensureMessageStructure(message);

  if (!isTaskRunning || (currentMode !== 'show' && currentMode !== 'do')) {
    // Remove thinking marker
    if (hasThinkingMarker(msg.content)) {
      return {
        ...msg,
        content: msg.content.replace(/\n\n__THINKING__$/, '').replace(/__THINKING__/g, ''),
        placeholderState: undefined, // Clear placeholder state when not thinking
      };
    }
    return msg;
  }

  const targetState = isWaitingForUser ? 'waiting-for-user' : 'thinking';

  // Add thinking marker if not present and it is the latest message
  // Here we just ensure the marker exists if the caller decided to update this message.
  if (!hasThinkingMarker(msg.content)) {
    return {
      ...msg,
      content: addThinkingMarker(msg.content),
      placeholderState: targetState,
    };
  } else if (msg.placeholderState !== targetState) {
    // Ensure state aligns with marker presence if needed
    return {
      ...msg,
      placeholderState: targetState,
    };
  }

  return msg;
}
/**
 * Tool Name Mapping — derived from BROWSER_TOOLS (single source of truth).
 * Provides friendly display names for technical tool names.
 */
export const TOOL_NAME_MAPPING: Record<string, string> = Object.fromEntries(
  BROWSER_TOOLS.map(t => [t.id, t.displayAction]),
);

/**
 * Get a friendly display name for a tool
 * Converts snake_case to Title Case if no mapping exists
 */
export function getFriendlyToolName(toolName: string): string {
  // Check explicit mapping first
  if (TOOL_NAME_MAPPING[toolName]) {
    return TOOL_NAME_MAPPING[toolName];
  }

  // Fallback: Convert snake_case or camelCase to Title Case
  // e.g. "my_custom_tool" -> "My Custom Tool"
  // e.g. "myCustomTool" -> "My Custom Tool"
  return (
    toolName
      // Insert space before capital letters (camelCase)
      .replace(/([A-Z])/g, ' $1')
      // Replace underscores with spaces (snake_case)
      .replace(/_/g, ' ')
      // Trim extra spaces
      .trim()
      // Capitalize first letter of each word
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  );
}

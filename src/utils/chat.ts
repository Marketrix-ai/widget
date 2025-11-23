/**
 * Message Content Utilities
 *
 * Centralized utilities for message content transformation, including:
 * - Removing thinking markers
 */

import type { ChatMessage, InstructionType } from '../types';

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
    if (
      msg.sender === 'agent' &&
      !msg.isSystemMessage &&
      !msg.isScreenAccessRequest &&
      !msg.isPlaceholder
    ) {
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
 * message finding code across websocket handlers.
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
        !requireContent || msg.content.trim().length > 0 || (msg.parts && msg.parts.length > 0);

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
        partsCount: msg.parts?.length,
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
        !requireContent || msg.content.trim().length > 0 || (msg.parts && msg.parts.length > 0);

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
 * Add a new progress step to a message
 */
export function addProgressLine(
  message: ChatMessage,
  toolName: string,
  explanation: string
): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  const existingPartIndex = parts.findIndex(
    (part) => part.type === 'progress' && part.toolName === toolName && part.status === 'running'
  );

  if (existingPartIndex >= 0) {
    newParts[existingPartIndex] = {
      ...newParts[existingPartIndex],
      content: explanation,
    };
  } else {
    newParts.push({
      type: 'progress',
      content: explanation,
      status: 'running',
      toolName,
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
  error?: string
): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  const partIndex = parts
    .map((p) => (p.type === 'progress' ? p.toolName : ''))
    .lastIndexOf(toolName);

  const mappedStatus = status === 'pending' ? 'running' : status;

  if (partIndex >= 0) {
    newParts[partIndex] = {
      ...newParts[partIndex],
      status: mappedStatus,
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
      content: `Executing ${toolName}...`,
      status: mappedStatus,
      toolName,
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
    partIndex = parts.map((p) => (p.type === 'progress' ? p.toolName : '')).lastIndexOf(toolName);
  } else {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'progress' && parts[i].status === 'running') {
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
export function markProgressLineFailed(
  message: ChatMessage,
  toolName: string,
  error: string
): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // Update Parts
  const newParts = [...parts];
  let partIndex = parts.map((p) => (p.type === 'progress' ? p.toolName : '')).lastIndexOf(toolName);
  if (partIndex === -1) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'progress' && parts[i].status === 'running') {
        partIndex = i;
        break;
      }
    }
  }

  if (partIndex >= 0) {
    newParts[partIndex] = {
      ...newParts[partIndex],
      status: 'failed',
      content: `${newParts[partIndex].content} (${error})`,
    };
  }

  return { ...msg, parts: newParts };
}

/**
 * Add or remove thinking marker based on task state
 */
export function updateThinkingMarker(
  message: ChatMessage,
  isTaskRunning: boolean,
  currentMode: 'show' | 'tell' | 'do'
): ChatMessage {
  const msg = ensureMessageStructure(message);

  if (!isTaskRunning || (currentMode !== 'show' && currentMode !== 'do')) {
    // Remove thinking marker
    if (hasThinkingMarker(msg.content)) {
      return {
        ...msg,
        content: msg.content.replace(/\n\n__THINKING__$/, '').replace(/__THINKING__/g, ''),
      };
    }
    return msg;
  }

  // Add thinking marker if not present
  if (!hasThinkingMarker(msg.content)) {
    return {
      ...msg,
      content: addThinkingMarker(msg.content),
    };
  }

  return msg;
}
/**
 * Tool Name Mapping Utility
 *
 * Provides friendly display names for technical tool names.
 * Used for showing user-friendly progress updates in the chat.
 */

export const TOOL_NAME_MAPPING: Record<string, string> = {
  // Navigation & Browser
  navigate_to_url: 'Navigating to URL',
  go_back: 'Going back',
  go_forward: 'Going forward',
  refresh_page: 'Refreshing page',

  // Interaction
  click_element: 'Clicking element',
  hover_element: 'Hovering element',
  type_text: 'Typing text',
  press_key: 'Pressing key',
  select_option: 'Selecting option',
  scroll_to_element: 'Scrolling to element',

  // Information Retrieval
  get_page_content: 'Reading page content',
  get_element_text: 'Reading element text',
  get_element_attribute: 'Reading element attribute',
  take_screenshot: 'Taking screenshot',

  // Logic & Flow
  wait_for_element: 'Waiting for element',
  sleep: 'Waiting',

  // Default fallback pattern handling in getFriendlyToolName
};

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
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  );
}

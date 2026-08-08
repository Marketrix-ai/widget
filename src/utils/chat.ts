import type { ChatMessage, InstructionType } from '../types';
import { BROWSER_TOOLS } from '../types/browserTools';

export function removeThinkingMarkers(content: string): string {
  return content.replace(/__THINKING__/g, '');
}

export function removeThinkingMarkerFromEnd(content: string): string {
  return content.replace(/\n\n__THINKING__$/, '').replace(/__THINKING__/g, '');
}

export function hasThinkingMarker(content: string): boolean {
  return content.includes('__THINKING__');
}

export function addThinkingMarker(content: string): string {
  if (hasThinkingMarker(content)) return content;
  return `${content}\n\n__THINKING__`;
}

function findTaskMessageIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest && !msg.isPlaceholder) {
      return i;
    }
  }
  return -1;
}

export interface FindMessageOptions {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  currentMode: InstructionType;
  requireContent?: boolean;
}

function matchesProgressCriteria(
  msg: ChatMessage,
  isTaskRunning: boolean,
  currentMode: InstructionType,
  requireContent: boolean | undefined,
  checkMode: boolean,
): boolean {
  if (msg.sender !== 'agent' || msg.isSystemMessage || msg.isScreenAccessRequest) {
    return false;
  }

  // Active show/do: require mode match, but stay lenient on placeholders with undefined mode — tool calls can race ahead of the mode being set.
  if (checkMode && isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    if (msg.isPlaceholder) {
      if (msg.mode !== undefined && msg.mode !== currentMode) {
        return false;
      }
    } else {
      if (msg.mode !== currentMode) {
        return false;
      }
    }
  }

  if (requireContent) {
    const hasText = msg.content.trim().length > 0;
    const hasProgress = msg.parts && msg.parts.length > 0;
    if (!hasText && !hasProgress) {
      return false;
    }
  }

  return true;
}

export function findMessageForProgress(options: FindMessageOptions): {
  index: number;
  message: ChatMessage;
} | null {
  const { messages, isTaskRunning, currentMode, requireContent } = options;
  let taskMessageIndex = -1;

  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    const checkMode = true;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const matchesCriteria = matchesProgressCriteria(msg, isTaskRunning, currentMode, requireContent, checkMode);
      const isPlaceholder = msg.isPlaceholder;
      const hasContent = !requireContent || msg.content.trim().length > 0 || (msg.parts && msg.parts.length > 0);

      if (matchesCriteria && isPlaceholder && hasContent) {
        taskMessageIndex = i;
        break;
      }
    }

    if (taskMessageIndex < 0 && !requireContent) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const matchesCriteria = matchesProgressCriteria(msg, isTaskRunning, currentMode, requireContent, checkMode);
        const isPlaceholder = msg.isPlaceholder;

        if (matchesCriteria && isPlaceholder) {
          taskMessageIndex = i;
          break;
        }
      }
    }

    if (taskMessageIndex < 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const matchesCriteria = matchesProgressCriteria(msg, isTaskRunning, currentMode, requireContent, checkMode);
        const isPlaceholder = msg.isPlaceholder;

        if (matchesCriteria && !isPlaceholder) {
          taskMessageIndex = i;
          break;
        }
      }
    }
  }

  // Tool calls can arrive before isTaskRunning flips true, so always fall back to a mode-agnostic match.
  if (taskMessageIndex < 0) {
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

    if (taskMessageIndex < 0 && !requireContent) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.sender === 'agent' && msg.isPlaceholder && !msg.isSystemMessage && !msg.isScreenAccessRequest) {
          taskMessageIndex = i;
          break;
        }
      }
    }

    if (taskMessageIndex < 0) {
      taskMessageIndex = findTaskMessageIndex(messages);
    }

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
  });
  return null;
}

function ensureMessageStructure(message: ChatMessage): ChatMessage {
  const msg = { ...message };

  if (!msg.parts) {
    msg.parts = [];

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

const INTERACTIVE_TOOLS = new Set([
  'click_element',
  'type_text',
  'send_keys',
  'select_dropdown_option',
  'upload_file',
  'scroll',
]);

// In `show` mode these pause for the user to act (DOM-mutating tools, minus `scroll`); also the highlight set in BrowserToolService.
export const WAIT_FOR_USER_TOOLS = new Set([
  'click_element',
  'type_text',
  'select_dropdown_option',
  'send_keys',
  'upload_file',
]);

// "Cancelled by cleanup" is expected internal chatter users shouldn't see.
function filterCancellationText(content: string): string {
  if (!content) return content;
  return content
    .replace(/\(Cancelled by cleanup\)/gi, '')
    .replace(/\(cancelled by cleanup\)/gi, '')
    .replace(/Cancelled by cleanup/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function addProgressLine(message: ChatMessage, browserToolName: string, explanation: string): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  const newParts = [...parts];
  const existingPartIndex = parts.findIndex(
    part => part.type === 'progress' && part.browserToolName === browserToolName && part.status === 'in_progress',
  );

  const isInteractive = INTERACTIVE_TOOLS.has(browserToolName);
  const hideIcon = !isInteractive;
  const textStyle = 'default';

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
      browserToolName,
      hideIcon,
      textStyle,
    });
  }

  return {
    ...msg,
    parts: newParts,
  };
}

export function markProgressLineComplete(message: ChatMessage, browserToolName?: string): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  const newParts = [...parts];
  let partIndex = -1;
  if (browserToolName) {
    partIndex = parts.map(p => (p.type === 'progress' ? p.browserToolName : '')).lastIndexOf(browserToolName);
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

export function markProgressLineFailed(message: ChatMessage, browserToolName: string, error: string): ChatMessage {
  const msg = ensureMessageStructure(message);
  const parts = msg.parts || [];

  // "Cancelled by cleanup" errors are expected in show mode when a new action supersedes a pending one.
  const shouldFilterError = error.toLowerCase().includes('cancelled by cleanup');

  const newParts = [...parts];
  let partIndex = parts.map(p => (p.type === 'progress' ? p.browserToolName : '')).lastIndexOf(browserToolName);
  if (partIndex === -1) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'progress' && parts[i].status === 'in_progress') {
        partIndex = i;
        break;
      }
    }
  }

  if (partIndex >= 0) {
    if (shouldFilterError) {
      const cleanedContent = filterCancellationText(newParts[partIndex].content);
      newParts[partIndex] = {
        ...newParts[partIndex],
        status: 'completed',
        content: cleanedContent,
      };
    } else {
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

export function updateThinkingMarker(
  message: ChatMessage,
  isTaskRunning: boolean,
  currentMode: 'show' | 'tell' | 'do',
  isWaitingForUser: boolean = false,
): ChatMessage {
  const msg = ensureMessageStructure(message);

  if (!isTaskRunning || (currentMode !== 'show' && currentMode !== 'do')) {
    if (hasThinkingMarker(msg.content)) {
      return {
        ...msg,
        content: msg.content.replace(/\n\n__THINKING__$/, '').replace(/__THINKING__/g, ''),
        placeholderState: undefined,
      };
    }
    return msg;
  }

  const targetState = isWaitingForUser ? 'waiting-for-user' : 'thinking';

  if (!hasThinkingMarker(msg.content)) {
    return {
      ...msg,
      content: addThinkingMarker(msg.content),
      placeholderState: targetState,
    };
  } else if (msg.placeholderState !== targetState) {
    return {
      ...msg,
      placeholderState: targetState,
    };
  }

  return msg;
}

export const TOOL_NAME_MAPPING: Record<string, string> = Object.fromEntries(
  BROWSER_TOOLS.map(t => [t.id, t.displayAction]),
);

export function getFriendlyToolName(browserToolName: string): string {
  if (TOOL_NAME_MAPPING[browserToolName]) {
    return TOOL_NAME_MAPPING[browserToolName];
  }

  return browserToolName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

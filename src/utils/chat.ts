import type { ChatMessage, InstructionType } from '../types';

const MODE_DISPLAY_NAMES: Record<InstructionType, string> = { show: 'Show', tell: 'Tell', do: 'Do' };

export const getModeDisplayName = (mode: InstructionType): string => MODE_DISPLAY_NAMES[mode];

export const formatMessageTime = (date: Date | undefined): string =>
  (date ?? new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

export interface FindMessageOptions {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  currentMode: InstructionType;
  requireContent?: boolean;
}

function lastMatch(messages: ChatMessage[], matches: (msg: ChatMessage) => boolean): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (matches(messages[i])) return i;
  }
  return -1;
}

/** Ranked predicates: the first rank matching anything wins, and within it the newest message. */
export function findMessageForProgress({
  messages,
  isTaskRunning,
  currentMode,
  requireContent,
}: FindMessageOptions): { index: number; message: ChatMessage } | null {
  const isAgentReply = (msg: ChatMessage) =>
    msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest;
  const hasContent = (msg: ChatMessage) => !requireContent || msg.content.trim().length > 0 || msg.parts.length > 0;
  // Lenient on placeholders with an undefined mode — tool calls can race ahead of the mode being set.
  const modeMatches = (msg: ChatMessage) =>
    msg.isPlaceholder ? msg.mode === undefined || msg.mode === currentMode : msg.mode === currentMode;

  const ranked: Array<(msg: ChatMessage) => boolean> = [];
  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    ranked.push(
      msg => isAgentReply(msg) && modeMatches(msg) && hasContent(msg) && !!msg.isPlaceholder,
      msg => isAgentReply(msg) && modeMatches(msg) && hasContent(msg) && !msg.isPlaceholder,
    );
  }
  // Tool calls can arrive before isTaskRunning flips true, so always fall back to a mode-agnostic match.
  ranked.push(
    msg => isAgentReply(msg) && !!msg.isPlaceholder && hasContent(msg),
    msg => isAgentReply(msg) && !msg.isPlaceholder,
    isAgentReply,
  );

  for (const matches of ranked) {
    const index = lastMatch(messages, matches);
    if (index >= 0) return { index, message: messages[index] };
  }

  console.warn('[MessageFinder] No message found for progress update', {
    totalMessages: messages.length,
    isTaskRunning,
    currentMode,
  });
  return null;
}

// In `show` mode these pause for the user to act (DOM-mutating tools, minus `scroll`); also the highlight set in BrowserToolService.
export const WAIT_FOR_USER_TOOLS = new Set([
  'click_element',
  'type_text',
  'select_dropdown_option',
  'send_keys',
  'upload_file',
]);

// "Cancelled by cleanup" is expected internal chatter users shouldn't see.
export function filterCancellationText(content: string): string {
  if (!content) return content;
  return content
    .replace(/\(Cancelled by cleanup\)/gi, '')
    .replace(/\(cancelled by cleanup\)/gi, '')
    .replace(/Cancelled by cleanup/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function addProgressLine(message: ChatMessage, browserToolName: string, explanation: string): ChatMessage {
  const parts = message.parts;
  const newParts = [...parts];
  const existingPartIndex = parts.findIndex(
    part => part.type === 'progress' && part.browserToolName === browserToolName && part.status === 'in_progress',
  );

  const cleanedExplanation = filterCancellationText(explanation);

  if (existingPartIndex >= 0) {
    newParts[existingPartIndex] = {
      ...newParts[existingPartIndex],
      content: cleanedExplanation,
    };
  } else {
    newParts.push({
      type: 'progress',
      content: cleanedExplanation,
      status: 'in_progress',
      browserToolName,
    });
  }

  return { ...message, parts: newParts };
}

export function markProgressLineComplete(message: ChatMessage): ChatMessage {
  const parts = message.parts;
  const newParts = [...parts];
  let partIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].type === 'progress' && parts[i].status === 'in_progress') {
      partIndex = i;
      break;
    }
  }

  if (partIndex >= 0) {
    newParts[partIndex] = { ...newParts[partIndex], status: 'completed' };
  }

  return { ...message, parts: newParts };
}

export function markProgressLineFailed(message: ChatMessage, browserToolName: string, error: string): ChatMessage {
  const parts = message.parts;

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

  return { ...message, parts: newParts };
}

export function updateThinkingMarker(
  message: ChatMessage,
  isTaskRunning: boolean,
  currentMode: 'show' | 'tell' | 'do',
  isWaitingForUser: boolean = false,
): ChatMessage {
  if (!isTaskRunning || (currentMode !== 'show' && currentMode !== 'do')) {
    if (!hasThinkingMarker(message.content)) return message;
    return { ...message, content: removeThinkingMarkerFromEnd(message.content), placeholderState: undefined };
  }

  const targetState = isWaitingForUser ? 'waiting-for-user' : 'thinking';

  if (!hasThinkingMarker(message.content)) {
    return { ...message, content: addThinkingMarker(message.content), placeholderState: targetState };
  }
  if (message.placeholderState !== targetState) {
    return { ...message, placeholderState: targetState };
  }
  return message;
}

/** Tool id -> the phrase shown in the activity log. Also the allowlist of tools the agent may call. */
export const BROWSER_TOOLS = new Map<string, string>([
  ['navigate', 'Navigating'],
  ['search', 'Searching'],
  ['click_element', 'Clicking element'],
  ['type_text', 'Typing text'],
  ['scroll', 'Scrolling'],
  ['scroll_to_text', 'Scrolling to text'],
  ['send_keys', 'Pressing key'],
  ['extract', 'Extracting content'],
  ['get_dropdown_options', 'Reading dropdown options'],
  ['select_dropdown_option', 'Selecting option'],
  ['upload_file', 'Uploading file'],
  ['go_back', 'Going back'],
  ['wait', 'Waiting'],
  ['close_tab', 'Closing tab'],
  ['done', 'Done'],
  ['get_html', 'Viewed your screen'],
  ['get_screenshot', 'Taking screenshot'],
]);

export function getFriendlyToolName(browserToolName: string): string {
  const friendly = BROWSER_TOOLS.get(browserToolName);
  if (friendly) return friendly;

  return browserToolName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

import type { ChatMessage, InstructionType, MessagePart } from '../types';

const MODE_DISPLAY_NAMES: Record<InstructionType, string> = { show: 'Show', tell: 'Tell', do: 'Do' };

export const getModeDisplayName = (mode: InstructionType): string => MODE_DISPLAY_NAMES[mode];

export const formatMessageTime = (date: Date | undefined): string =>
  (date ?? new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export interface FindMessageOptions {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  currentMode: InstructionType;
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
}: FindMessageOptions): { index: number; message: ChatMessage } | null {
  const isAgentReply = (msg: ChatMessage) =>
    msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest;
  // Lenient on placeholders with an undefined mode — tool calls can race ahead of the mode being set.
  const modeMatches = (msg: ChatMessage) =>
    msg.isPlaceholder ? msg.mode === undefined || msg.mode === currentMode : msg.mode === currentMode;

  const ranked: Array<(msg: ChatMessage) => boolean> = [];
  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    ranked.push(
      msg => isAgentReply(msg) && modeMatches(msg) && !!msg.isPlaceholder,
      msg => isAgentReply(msg) && modeMatches(msg),
    );
  }
  // Tool calls can arrive before isTaskRunning flips true, so always fall back to a mode-agnostic match.
  ranked.push(msg => isAgentReply(msg) && !!msg.isPlaceholder, isAgentReply);

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
    .replace(/\(?cancelled by cleanup\)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const isOpenProgress = (part: MessagePart): boolean => part.type === 'progress' && part.status === 'in_progress';

function lastPartIndex(parts: MessagePart[], matches: (part: MessagePart) => boolean): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (matches(parts[i])) return i;
  }
  return -1;
}

function patchPart(message: ChatMessage, index: number, patch: Partial<MessagePart>): ChatMessage {
  if (index < 0) return message;
  const parts = [...message.parts];
  parts[index] = { ...parts[index], ...patch };
  return { ...message, parts };
}

export function addProgressLine(message: ChatMessage, browserToolName: string, explanation: string): ChatMessage {
  const content = filterCancellationText(explanation);
  const open = message.parts.findIndex(part => isOpenProgress(part) && part.browserToolName === browserToolName);
  if (open >= 0) return patchPart(message, open, { content });
  return {
    ...message,
    parts: [...message.parts, { type: 'progress', content, status: 'in_progress', browserToolName }],
  };
}

export const markProgressLineComplete = (message: ChatMessage): ChatMessage =>
  patchPart(message, lastPartIndex(message.parts, isOpenProgress), { status: 'completed' });

export function markProgressLineFailed(message: ChatMessage, browserToolName: string, error: string): ChatMessage {
  const named = lastPartIndex(
    message.parts,
    part => part.type === 'progress' && part.browserToolName === browserToolName,
  );
  const index = named >= 0 ? named : lastPartIndex(message.parts, isOpenProgress);
  if (index < 0) return message;

  const content = filterCancellationText(message.parts[index].content);
  // In show mode a new action supersedes a pending one and cancels it — that is a completed step, not a failure.
  if (error.toLowerCase().includes('cancelled by cleanup'))
    return patchPart(message, index, { status: 'completed', content });

  const cleanedError = filterCancellationText(error);
  return patchPart(message, index, {
    status: 'failed',
    content: cleanedError ? `${content} (${cleanedError})` : content,
  });
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

// ChatContext rejects a tool/call whose name is not in BROWSER_TOOLS before the reducer sees it.
export const getFriendlyToolName = (browserToolName: string): string =>
  BROWSER_TOOLS.get(browserToolName) ?? browserToolName;

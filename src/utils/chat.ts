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

export function lastIndexWhere<T>(items: T[], matches: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (matches(items[i])) return i;
  }
  return -1;
}

/** Ranked predicates: the first rank matching anything wins, and within it the newest message. */
export function findMessageForProgress({
  messages,
  isTaskRunning,
  currentMode,
}: FindMessageOptions): { index: number; message: ChatMessage } | null {
  // A terminal-stamped message already ended — a duplicate or late-arriving progress/terminal event
  // must fall through to no match rather than flip its icon (e.g. a late `completed` overwriting a `stopped`).
  const isAgentReply = (msg: ChatMessage) =>
    msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest && !msg.taskStatus;
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

  // Bound every rank to messages newer than the last ended run — otherwise a duplicate or late-arriving
  // event with nothing left to claim falls back past a taskStatus stamp onto an older, already-settled reply.
  const start = lastIndexWhere(messages, msg => msg.sender === 'agent' && !!msg.taskStatus) + 1;
  const open = messages.slice(start);

  for (const matches of ranked) {
    const index = lastIndexWhere(open, matches);
    if (index >= 0) return { index: start + index, message: open[index] };
  }

  console.warn('[MessageFinder] No message found for progress update', {
    totalMessages: messages.length,
    isTaskRunning,
    currentMode,
  });
  return null;
}

// "Cancelled by cleanup" is expected internal chatter users shouldn't see.
const filterCancellationText = (content: string): string => content.replace(/\(?cancelled by cleanup\)?/gi, '').trim();

const isOpenProgress = (part: MessagePart): boolean => part.type === 'progress' && part.status === 'in_progress';

function patchPart(message: ChatMessage, index: number, patch: Partial<MessagePart>): ChatMessage {
  if (index < 0) return message;
  const parts = [...message.parts];
  parts[index] = { ...parts[index], ...patch };
  return { ...message, parts };
}

const openLineFor = (message: ChatMessage, browserToolName: string): number =>
  message.parts.findIndex(part => isOpenProgress(part) && part.browserToolName === browserToolName);

export function addProgressLine(message: ChatMessage, browserToolName: string, explanation: string): ChatMessage {
  const content = filterCancellationText(explanation);
  const open = openLineFor(message, browserToolName);
  if (open >= 0) return patchPart(message, open, { content });
  return {
    ...message,
    parts: [...message.parts, { type: 'progress', content, status: 'in_progress', browserToolName }],
  };
}

export const markProgressLineComplete = (message: ChatMessage, browserToolName: string): ChatMessage =>
  patchPart(message, openLineFor(message, browserToolName), { status: 'completed' });

export function markProgressLineFailed(message: ChatMessage, browserToolName: string, error: string): ChatMessage {
  const index = openLineFor(message, browserToolName);
  if (index < 0) return message;

  const content = filterCancellationText(message.parts[index].content);
  const cleanedError = filterCancellationText(error);
  return patchPart(message, index, {
    status: 'failed',
    content: cleanedError ? `${content} (${cleanedError})` : content,
  });
}

function createMessage(
  idPrefix: string,
  sender: 'user' | 'agent',
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: `${idPrefix}-${Date.now()}`,
    content,
    sender,
    timestamp: new Date(),
    parts: content ? [{ type: 'text', content }] : [],
    ...extra,
  };
}

export const createUserMessage = (content: string, mode?: InstructionType, idPrefix = 'user-message'): ChatMessage =>
  createMessage(idPrefix, 'user', content.trim(), { mode });

export const createAgentMessage = (content: string): ChatMessage =>
  createMessage('agent-message', 'agent', content.trim());

export const createSystemMessage = (content: string, idPrefix: string): ChatMessage =>
  createMessage(idPrefix, 'agent', content, { isSystemMessage: true });

export const createScreenAccessRequestMessage = (
  mode: InstructionType | undefined,
  pendingContent?: string,
): ChatMessage =>
  createMessage('screen-access-request', 'agent', 'Can I take a look at your screen?', {
    mode,
    isScreenAccessRequest: true,
    pendingContent,
  });

export const createScreenshareMessage = (stream: MediaStream, mode: InstructionType = 'show'): ChatMessage =>
  createMessage('screenshare', 'user', '', { mode, videoStream: stream });

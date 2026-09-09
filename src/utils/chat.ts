/**
 * Pure helpers for the chat message list. `getModeDisplayName` labels an `InstructionType`; `formatMessageTime`
 * formats hh:mm, defaulting to now for an undated message; `lastIndexWhere` is a newest-first index search (also
 * used by `useScreenShare`); `findMessageForProgress` picks the agent reply a `tool/call` or progress event should
 * render into. `addProgressLine` / `markProgressLineComplete` / `markProgressLineFailed` append or settle the open
 * progress part for one `browserToolName`, via `openLineFor` and the shared `patchPart` copy-on-write.
 * `createMessage` and its per-sender constructors are the ONLY way a `ChatMessage` is built: ids are
 * `<prefix>-<uuid>` since two messages minted in one millisecond used to collide, and empty content yields
 * no `text` part, the screen-share bubble rendering from `videoStream` alone and a placeholder having
 * nothing to say yet.
 *
 * `SCREEN_ACCESS_PROMPT` is the one wording of the screen-access ask — the transcript card and the
 * toolbar dialog are two renderings of the same question and must not drift apart.
 *
 * `findMessageForProgress` is ranked predicates: the first rank matching anything wins, and within a rank the
 * newest message. Every rank is bounded to messages after the last agent message carrying a `taskStatus`, since a
 * terminal stamp means that run already ended — unbounded, a late-arriving event reaches back past the stamp onto
 * an already-settled reply, and a late `completed` overwrites a `stopped` icon. Placeholders with `mode` still
 * undefined match leniently, and a mode-agnostic rank is always appended, since a `tool/call` can arrive before
 * the mode is set. No match is a legitimate outcome, warned not thrown. `filterCancellationText` strips "cancelled
 * by cleanup" from progress content and error text — expected chatter from a torn-down run a visitor should never
 * see.
 */
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

export function findMessageForProgress({
  messages,
  isTaskRunning,
  currentMode,
}: FindMessageOptions): { index: number; message: ChatMessage } | null {
  const isAgentReply = (msg: ChatMessage) =>
    msg.sender === 'agent' && !msg.isSystemMessage && !msg.isScreenAccessRequest && !msg.taskStatus;
  const modeMatches = (msg: ChatMessage) =>
    msg.isPlaceholder ? msg.mode === undefined || msg.mode === currentMode : msg.mode === currentMode;

  const ranked: Array<(msg: ChatMessage) => boolean> = [];
  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    ranked.push(
      msg => isAgentReply(msg) && modeMatches(msg) && !!msg.isPlaceholder,
      msg => isAgentReply(msg) && modeMatches(msg),
    );
  }
  ranked.push(msg => isAgentReply(msg) && !!msg.isPlaceholder, isAgentReply);

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

const filterCancellationText = (content: string): string => content.replace(/\(?cancelled by cleanup\)?/gi, '').trim();

function patchPart(message: ChatMessage, index: number, patch: Partial<MessagePart>): ChatMessage {
  if (index < 0) return message;
  const parts = [...message.parts];
  parts[index] = { ...parts[index], ...patch };
  return { ...message, parts };
}

const openLineFor = (message: ChatMessage, browserToolName: string): number =>
  message.parts.findIndex(
    part => part.type === 'progress' && part.status === 'in_progress' && part.browserToolName === browserToolName,
  );

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
    id: `${idPrefix}-${globalThis.crypto.randomUUID()}`,
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

export const SCREEN_ACCESS_PROMPT = 'Can I take a look at your screen?';

export const createScreenAccessRequestMessage = (
  mode: InstructionType | undefined,
  pendingContent?: string,
): ChatMessage =>
  createMessage('screen-access-request', 'agent', SCREEN_ACCESS_PROMPT, {
    mode,
    isScreenAccessRequest: true,
    pendingContent,
  });

export const createScreenshareMessage = (stream: MediaStream, mode: InstructionType = 'show'): ChatMessage =>
  createMessage('screenshare', 'user', '', { mode, videoStream: stream });

export const createPlaceholderMessage = (mode: InstructionType): ChatMessage =>
  createMessage('temp', 'agent', '', { mode, isPlaceholder: true, placeholderState: 'thinking' });

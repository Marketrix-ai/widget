/**
 * Pure helpers for the chat message list: formatting (mode label, timestamp), finding which message a
 * progress or tool event belongs to, and building every kind of `ChatMessage`.
 *
 * `findMessageForProgress` picks the right open message for an incoming update by a ranked set of
 * predicates, falling back to "no match" (logged, not thrown) rather than guessing wrong. `createMessage`
 * and its per-sender constructors are the only way a `ChatMessage` is built, so ids and shape stay
 * consistent. `CHAT_FAILURE_TEXT` and `SCREEN_ACCESS_PROMPT` are the one wording each site uses for
 * those two situations, so the failure text never leaks raw server error details to a visitor.
 */
import type { ChatMessage, InstructionType, MessagePart } from '../types';
import { logWarn } from './log';

export const MODE_LABELS: Record<InstructionType, string> = { show: 'Show', tell: 'Tell', do: 'Do' };

export const formatMessageTime = (date: Date | undefined): string =>
  (date ?? new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface FindMessageOptions {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  currentMode: InstructionType;
}

export function lastIndexWhere<T>(items: T[], matches: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item !== undefined && matches(item)) return i;
  }
  return -1;
}

export function findMessageForProgress({
  messages,
  isTaskRunning,
  currentMode,
}: FindMessageOptions): { index: number; message: ChatMessage } | null {
  const isAgentReply = (msg: ChatMessage) => msg.kind === 'agent' && !msg.taskStatus;
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

  const start = lastIndexWhere(messages, msg => !!msg.taskStatus) + 1;
  const open = messages.slice(start);

  for (const matches of ranked) {
    const index = lastIndexWhere(open, matches);
    const message = index >= 0 ? open[index] : undefined;
    if (message) return { index: start + index, message };
  }

  logWarn(
    `[MessageFinder] No message found for progress update: totalMessages=${messages.length} isTaskRunning=${isTaskRunning} currentMode=${currentMode}`,
  );
  return null;
}

function patchPart(message: ChatMessage, index: number, patch: Partial<MessagePart>): ChatMessage {
  const current = index >= 0 ? message.parts[index] : undefined;
  if (!current) return message;
  const parts = [...message.parts];
  parts[index] = { ...current, ...patch };
  return { ...message, parts };
}

const openLineFor = (message: ChatMessage, browserToolName: string): number =>
  message.parts.findIndex(
    part => part.type === 'progress' && part.status === 'in_progress' && part.browserToolName === browserToolName,
  );

export function addProgressLine(message: ChatMessage, browserToolName: string, explanation: string): ChatMessage {
  const open = openLineFor(message, browserToolName);
  if (open >= 0) return patchPart(message, open, { content: explanation });
  return {
    ...message,
    parts: [...message.parts, { type: 'progress', content: explanation, status: 'in_progress', browserToolName }],
  };
}

export const markProgressLineComplete = (message: ChatMessage, browserToolName: string): ChatMessage =>
  patchPart(message, openLineFor(message, browserToolName), { status: 'completed' });

export function markProgressLineFailed(message: ChatMessage, browserToolName: string, error: string): ChatMessage {
  const index = openLineFor(message, browserToolName);
  const part = index >= 0 ? message.parts[index] : undefined;
  if (!part) return message;
  return patchPart(message, index, {
    status: 'failed',
    content: error ? `${part.content} (${error})` : part.content,
  });
}

function createMessage(kind: ChatMessage['kind'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `${kind}-${globalThis.crypto.randomUUID()}`,
    kind,
    timestamp: new Date(),
    parts: content ? [{ type: 'text', content }] : [],
    ...extra,
  };
}

export const createUserMessage = (content: string, mode: InstructionType): ChatMessage =>
  createMessage('user', content.trim(), { mode });

export const createAgentMessage = (content: string): ChatMessage => createMessage('agent', content.trim());

export const createSystemMessage = (content: string): ChatMessage => createMessage('system', content);

export const SCREEN_ACCESS_PROMPT = 'Can I take a look at your screen?';

export const CHAT_FAILURE_TEXT = "I'm sorry, I encountered an error processing your request. Please try again.";

export const createScreenAccessRequestMessage = (mode: InstructionType, pendingContent: string): ChatMessage =>
  createMessage('screenAccess', SCREEN_ACCESS_PROMPT, { mode, pendingContent });

export const createScreenshareMessage = (stream: MediaStream): ChatMessage =>
  createMessage('screenshare', '', { mode: 'show', videoStream: stream });

export const createPlaceholderMessage = (mode: InstructionType): ChatMessage =>
  createMessage('agent', '', { mode, isPlaceholder: true, placeholderState: 'thinking' });

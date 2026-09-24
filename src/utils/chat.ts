/**
 * Pure helpers for the chat message list: formatting (mode label, timestamp), the tenant's enabled modes
 * (`enabledModes`, `effectiveMode`), finding which message a progress or tool event belongs to, and building
 * every kind of `ChatMessage`.
 *
 * `findMessageForProgress` picks the right open message for an incoming update by a ranked set of
 * predicates, falling back to "no match" (logged, not thrown) rather than guessing wrong. The per-kind
 * constructors are the only way a `ChatMessage` is built, so ids and shape stay consistent.
 * `CHAT_FAILURE_TEXT` and the `SCREEN_ACCESS_*` pair are the one wording each site uses for those two
 * situations, so the failure text never leaks raw server error details to a visitor.
 * Show and Do read and act on the page through the DOM whatever the visitor answers, so declining screen
 * access withholds only the view of their screen.
 */
import { InstructionTypeSchema } from '../sdk/contracts/widgetSettings';
import type { WidgetToolName } from '../services/BrowserToolService';
import type { AgentMessage, ChatMessage, InstructionType, MessagePart, WidgetSettingsData } from '../types';
import { logWarn } from './log';
import { randomId } from './randomId';

export const MODE_LABELS: Record<InstructionType, string> = { show: 'Show', tell: 'Tell', do: 'Do' };

type ModeFlags = Pick<WidgetSettingsData, `widget_feature_${InstructionType}`>;

export const enabledModes = (flags: ModeFlags): InstructionType[] =>
  InstructionTypeSchema.options.filter(mode => flags[`widget_feature_${mode}`]);

export function effectiveMode(flags: ModeFlags, mode: InstructionType): InstructionType {
  const modes = enabledModes(flags);
  return modes.includes(mode) ? mode : (modes[0] ?? mode);
}

export const formatMessageTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface FindMessageOptions {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  currentMode: InstructionType;
}

export function findMessageForProgress({
  messages,
  isTaskRunning,
  currentMode,
}: FindMessageOptions): { index: number; message: AgentMessage } | null {
  const isAgentReply = (msg: ChatMessage): msg is AgentMessage => msg.kind === 'agent' && !msg.taskStatus;
  const modeMatches = (msg: AgentMessage) =>
    msg.isPlaceholder ? msg.mode === undefined || msg.mode === currentMode : msg.mode === currentMode;

  const ranked: Array<(msg: AgentMessage) => boolean> = [];
  if (isTaskRunning && (currentMode === 'show' || currentMode === 'do')) {
    ranked.push(msg => modeMatches(msg) && !!msg.isPlaceholder, modeMatches);
  }
  ranked.push(
    msg => !!msg.isPlaceholder,
    () => true,
  );

  const start = messages.findLastIndex(msg => msg.kind === 'agent' && !!msg.taskStatus) + 1;

  for (const matches of ranked) {
    const index = messages.findLastIndex((msg, i) => i >= start && isAgentReply(msg) && matches(msg));
    const message = messages[index];
    if (message?.kind === 'agent') return { index, message };
  }

  logWarn(
    `[MessageFinder] No message found for progress update: totalMessages=${messages.length} isTaskRunning=${isTaskRunning} currentMode=${currentMode}`,
  );
  return null;
}

function patchPart(message: AgentMessage, index: number, patch: Partial<MessagePart>): AgentMessage {
  const current = message.parts[index];
  if (!current) return message;
  const parts = [...message.parts];
  parts[index] = { ...current, ...patch };
  return { ...message, parts };
}

const openLineFor = (message: AgentMessage, browserToolName: WidgetToolName): number =>
  message.parts.findIndex(
    part => part.type === 'progress' && part.status === 'in_progress' && part.browserToolName === browserToolName,
  );

export function addProgressLine(
  message: AgentMessage,
  browserToolName: WidgetToolName,
  explanation: string,
): AgentMessage {
  const open = openLineFor(message, browserToolName);
  if (open >= 0) return patchPart(message, open, { content: explanation });
  return {
    ...message,
    parts: [...message.parts, { type: 'progress', content: explanation, status: 'in_progress', browserToolName }],
  };
}

export const markProgressLineComplete = (message: AgentMessage, browserToolName: WidgetToolName): AgentMessage =>
  patchPart(message, openLineFor(message, browserToolName), { status: 'completed' });

export function markProgressLineFailed(
  message: AgentMessage,
  browserToolName: WidgetToolName,
  error: string,
): AgentMessage {
  const index = openLineFor(message, browserToolName);
  const part = message.parts[index];
  if (!part) return message;
  return patchPart(message, index, {
    status: 'failed',
    content: error ? `${part.content} (${error})` : part.content,
  });
}

const newMessage = (kind: ChatMessage['kind'], content: string) => ({
  id: `${kind}-${randomId()}`,
  timestamp: new Date(),
  parts: content ? [{ type: 'text' as const, content }] : [],
});

export const createUserMessage = (content: string, mode: InstructionType): ChatMessage => ({
  ...newMessage('user', content.trim()),
  kind: 'user',
  mode,
});

export const createAgentMessage = (content: string): ChatMessage => ({
  ...newMessage('agent', content.trim()),
  kind: 'agent',
});

export const createSystemMessage = (content: string): ChatMessage => ({
  ...newMessage('system', content),
  kind: 'system',
});

export const SCREEN_ACCESS_PROMPT = 'Can I take a look at your screen?';

export const SCREEN_ACCESS_DETAIL =
  'Either way, the assistant reads this page and acts on it to help you. Saying no only keeps your screen private.';

export const CHAT_FAILURE_TEXT = "I'm sorry, I encountered an error processing your request. Please try again.";

export const createScreenAccessRequestMessage = (mode: InstructionType, pendingContent: string): ChatMessage => ({
  ...newMessage('screenAccess', ''),
  parts: [
    { type: 'text', content: SCREEN_ACCESS_PROMPT },
    { type: 'text', content: SCREEN_ACCESS_DETAIL },
  ],
  kind: 'screenAccess',
  mode,
  pendingContent,
});

export const createScreenshareMessage = (videoStream: MediaStream): ChatMessage => ({
  ...newMessage('screenshare', ''),
  kind: 'screenshare',
  videoStream,
});

export const createPlaceholderMessage = (mode: InstructionType): ChatMessage => ({
  ...newMessage('agent', ''),
  kind: 'agent',
  mode,
  isPlaceholder: true,
  placeholderState: 'thinking',
});

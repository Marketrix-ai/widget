/**
 * Pure helpers for the chat message list: formatting (mode label, timestamp, `messageText`), the tenant's
 * enabled modes, each browser tool's progress label (`toolExplanation`) and Show-mode wait (`waitsForUser`),
 * finding which message a progress event belongs to (`findMessageForProgress`, which logs rather than
 * guesses on no match), and the per-kind constructors that are the only way a `ChatMessage` is built.
 * `CHAT_FAILURE_TEXT` and the `SCREEN_ACCESS_*` pair are the one wording for those two situations, so a
 * visitor never sees a raw server error. Show and Do read and act on the page through the DOM whatever the
 * visitor answers, so declining screen access withholds only the view of their screen.
 */
import { InstructionTypeSchema } from '../sdk/contracts/widgetSettings';
import type { WidgetToolName } from '../services/browserTools';
import type {
  AgentMessage,
  AgentStatus,
  ChatMessage,
  InstructionType,
  MessagePart,
  WidgetSettingsData,
} from '../types';
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

const TOOL_LABELS: Record<WidgetToolName, string> = {
  navigate: 'Navigating',
  search: 'Searching',
  click_element: 'Clicking element',
  type_text: 'Typing text',
  scroll: 'Scrolling',
  scroll_to_text: 'Scrolling to text',
  extract: 'Extracting content',
  go_back: 'Going back',
  wait: 'Waiting',
  select_dropdown_option: 'Selecting option',
  get_dropdown_options: 'Reading dropdown options',
  send_keys: 'Pressing key',
  close_tab: 'Closing tab',
  done: 'Done',
  get_html: 'Reading the page',
  get_screenshot: 'Taking screenshot',
};

const WAITS_FOR_USER: ReadonlySet<WidgetToolName> = new Set([
  'click_element',
  'type_text',
  'select_dropdown_option',
  'send_keys',
]);

export const toolExplanation = (browserToolName: WidgetToolName, explanation?: string): string =>
  explanation || TOOL_LABELS[browserToolName];

export const waitsForUser = (browserToolName: WidgetToolName): boolean => WAITS_FOR_USER.has(browserToolName);

export const messageText = (parts: MessagePart[]): string =>
  parts
    .filter(part => part.type === 'text')
    .map(part => part.content)
    .join('\n');

export const formatMessageTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const PENDING_STATUSES = ['thinking', 'waiting-for-user'] as const;

export const ENDED_STATUSES = ['done', 'failed', 'stopped'] as const;

const hasStatus =
  (statuses: readonly AgentStatus[]) =>
  (msg: ChatMessage): boolean =>
    msg.kind === 'agent' && msg.status !== undefined && statuses.includes(msg.status);

export const isPending = hasStatus(PENDING_STATUSES);

export const taskEnded = hasStatus(ENDED_STATUSES);

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
  const isAgentReply = (msg: ChatMessage): msg is AgentMessage => msg.kind === 'agent' && !taskEnded(msg);
  const modeMatches = (msg: AgentMessage) =>
    isPending(msg) ? msg.mode === undefined || msg.mode === currentMode : msg.mode === currentMode;

  const ranked: Array<(msg: AgentMessage) => boolean> = [];
  if (isTaskRunning) {
    ranked.push(msg => modeMatches(msg) && isPending(msg), modeMatches);
  }
  ranked.push(isPending, () => true);

  const start = messages.findLastIndex(taskEnded) + 1;

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

export const SCREEN_SHARE_STARTED_TEXT = 'Screen sharing started';

export const SCREEN_SHARE_STOPPED_TEXT = 'Screen sharing stopped';

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
  status: 'thinking',
});

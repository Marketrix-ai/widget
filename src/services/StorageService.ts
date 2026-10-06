/**
 * The widget's one door to `localStorage` and `sessionStorage`: schema-checked reads, tenant-scoped keys, the
 * chat id and transcript snapshot, the tab id and started tool calls. Config and credentials are never
 * persisted, and a host page that denies storage falls back to memory. The tab id survives same-origin
 * navigations so the api keeps routing a Show/Do task's tool calls to this tab, and `claimToolCall` answers a
 * call resent after a reload `page_reloaded` rather than running it twice.
 */
import { z } from 'zod';

import { InstructionTypeSchema } from '../sdk/contracts/widgetSettings';
import { WIDGET_TOOL_NAMES } from '../sdk/contracts/widgetToolNames';
import type { ChatMessage, InstructionType, ValidWidgetConfig } from '../types';
import { ENDED_STATUSES, PENDING_STATUSES, SCREEN_SHARE_STOPPED_TEXT } from '../utils/chat';
import { logWarn } from '../utils/log';
import { randomId } from '../utils/randomId';

const STORAGE_KEY = 'marketrix_chat_context';
const TAB_ID_KEY = 'marketrix_tab_id';
const STARTED_TOOL_CALLS_KEY = 'marketrix_started_tool_calls';
const MAX_STARTED_TOOL_CALLS = 200;
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const MessagePartSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text'), content: z.string(), streaming: z.boolean().optional() }),
  z.strictObject({
    type: z.literal('progress'),
    content: z.string(),
    status: z.enum(['in_progress', 'completed', 'failed']),
    browserToolName: z.enum(WIDGET_TOOL_NAMES),
  }),
]);

const MessageBase = { id: z.string(), timestamp: z.coerce.date(), parts: z.array(MessagePartSchema) };

const MessageSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...MessageBase, kind: z.literal('user'), mode: InstructionTypeSchema }),
  z.strictObject({
    ...MessageBase,
    kind: z.literal('agent'),
    mode: InstructionTypeSchema.optional(),
    status: z.enum([...PENDING_STATUSES, 'question', ...ENDED_STATUSES]).optional(),
  }),
  z.strictObject({ ...MessageBase, kind: z.literal('system') }),
  z.strictObject({
    ...MessageBase,
    kind: z.literal('screenAccess'),
    mode: InstructionTypeSchema,
    pendingContent: z.string(),
    screenShareStatus: z.enum(['allowed', 'denied']).optional(),
  }),
]);

export type StoredMessage = z.infer<typeof MessageSchema>;

const ChatContextSchema = z.strictObject({
  chat_id: z.string().nullable().catch(null),
  messages: z
    .array(MessageSchema.nullable().catch(null))
    .catch([])
    .transform(items => items.filter(item => item !== null)),
  currentMode: InstructionTypeSchema.catch('tell'),
  isOpen: z.boolean().catch(false),
  timestamp: z.number().catch(0),
});

type ChatContext = z.infer<typeof ChatContextSchema>;

export interface ChatSnapshot {
  messages: ChatMessage[];
  currentMode: InstructionType;
  isOpen: boolean;
}

export function scopedKey(name: string, { mtxId }: Pick<ValidWidgetConfig, 'mtxId'>): string {
  return `${name}_${mtxId ?? 'default'}`;
}

const warned = new Set<string>();

function inStorage<T>(
  kind: 'localStorage' | 'sessionStorage',
  action: (storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) => T,
): T | undefined {
  try {
    return action(window[kind]);
  } catch (error) {
    if (!warned.has(kind))
      logWarn(`[StorageService] ${kind} is unusable, degrading to memory for this session:`, error);
    warned.add(kind);
    return undefined;
  }
}

function parseStored<T>(key: string, stored: string | null | undefined, schema: z.ZodType<T>): T | undefined {
  if (!stored) return undefined;
  try {
    return schema.parse(JSON.parse(stored));
  } catch (error) {
    logWarn(`[StorageService] Ignoring an unreadable stored ${key}:`, error);
    return undefined;
  }
}

export function readLocalParsed<T>(key: string, schema: z.ZodType<T>): T | undefined {
  return parseStored(
    key,
    inStorage('localStorage', storage => storage.getItem(key)),
    schema,
  );
}

export function writeLocal(key: string, value: unknown): void {
  inStorage('localStorage', storage => storage.setItem(key, JSON.stringify(value)));
}

function loadContext(key: string): ChatContext {
  const stored = readLocalParsed(key, ChatContextSchema);
  return stored && Date.now() - stored.timestamp <= CONTEXT_EXPIRY_MS ? stored : ChatContextSchema.parse({});
}

let contextKey = STORAGE_KEY;
let context = loadContext(contextKey);

function updateContext(updates: Partial<ChatContext>): void {
  context = { ...context, ...updates, timestamp: Date.now() };
  writeLocal(contextKey, context);
}

export function scopeStorageTo(config: Pick<ValidWidgetConfig, 'mtxId'>): void {
  contextKey = scopedKey(STORAGE_KEY, config);
  context = loadContext(contextKey);
}

export const getChatId = (): string | null => context.chat_id;

export const setChatId = (chatId: string): void => updateContext({ chat_id: chatId });

export const forgetChatId = (): void => updateContext({ chat_id: null });

let tabId: string | null = null;

export function claimTabId(): string {
  if (tabId !== null) return tabId;
  tabId = inStorage('sessionStorage', storage => storage.getItem(TAB_ID_KEY)) ?? randomId();
  inStorage('sessionStorage', storage => storage.removeItem(TAB_ID_KEY));
  window.addEventListener('pagehide', () =>
    inStorage('sessionStorage', storage => storage.setItem(TAB_ID_KEY, claimTabId())),
  );
  window.addEventListener('pageshow', () => inStorage('sessionStorage', storage => storage.removeItem(TAB_ID_KEY)));
  return tabId;
}

export function remintTabId(): void {
  claimTabId();
  tabId = randomId();
}

const StartedToolCallsSchema = z.array(z.string());
const pageToolCalls = new Set<string>();

type ToolCallClaim = 'fresh' | 'seen' | 'interrupted';

export function claimToolCall(toolCallId: string): ToolCallClaim {
  if (pageToolCalls.has(toolCallId)) return 'seen';
  pageToolCalls.add(toolCallId);
  const stored = inStorage('sessionStorage', storage => storage.getItem(STARTED_TOOL_CALLS_KEY));
  const started = parseStored(STARTED_TOOL_CALLS_KEY, stored, StartedToolCallsSchema) ?? [];
  if (started.includes(toolCallId)) return 'interrupted';
  const next = [...started, toolCallId].slice(-MAX_STARTED_TOOL_CALLS);
  inStorage('sessionStorage', storage => storage.setItem(STARTED_TOOL_CALLS_KEY, JSON.stringify(next)));
  return 'fresh';
}

export function readChatSnapshot(): ChatSnapshot {
  const { messages, currentMode, isOpen } = context;
  return { messages, currentMode, isOpen };
}

export function writeChatSnapshot(snapshot: ChatSnapshot): void {
  updateContext({
    ...snapshot,
    messages: snapshot.messages.map(msg =>
      msg.kind === 'screenshare'
        ? {
            id: msg.id,
            kind: 'system',
            timestamp: msg.timestamp,
            parts: [{ type: 'text', content: SCREEN_SHARE_STOPPED_TEXT }],
          }
        : msg,
    ),
  });
}

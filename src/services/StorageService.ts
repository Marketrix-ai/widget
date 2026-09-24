/**
 * Browser-local persistence for the widget: the one door to `localStorage` and `sessionStorage`.
 * `readLocalParsed`/`writeLocal` read through a schema and write JSON, `scopedKey`/`scopeStorageTo` scope keys
 * per tenant, `getChatId`/`setChatId`/`forgetChatId` hold the thread id, `readChatSnapshot`/`writeChatSnapshot`
 * the transcript, `claimTabId` the browser tab's identity, and `MessageSchema` defines a chat message. Config
 * and credentials are never persisted, and a host page that denies storage falls back to memory.
 * The tab id survives same-origin navigations and reloads so the api keeps routing a Show/Do task's tool
 * calls to this tab; a page takes it out of `sessionStorage` while alive, so a duplicated tab mints its own, and
 * `remintTabId` gives a page a fresh one when a tab duplicated mid-navigation still copied the id.
 */
import { z } from 'zod';

import { InstructionTypeSchema } from '../sdk/contracts/widgetSettings';
import { WIDGET_TOOL_NAMES } from '../sdk/contracts/widgetToolNames';
import type { ChatMessage, InstructionType, ValidWidgetConfig } from '../types';
import { logWarn } from '../utils/log';
import { randomId } from '../utils/randomId';

const STORAGE_KEY = 'marketrix_chat_context';
const TAB_ID_KEY = 'marketrix_tab_id';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const MessagePartSchema = z.object({
  type: z.enum(['text', 'progress']),
  content: z.string(),
  status: z.enum(['in_progress', 'completed', 'failed']).optional(),
  browserToolName: z.enum(WIDGET_TOOL_NAMES).optional(),
  streaming: z.boolean().optional(),
});

const MessageBase = { id: z.string(), timestamp: z.coerce.date(), parts: z.array(MessagePartSchema) };

const MessageSchema = z.discriminatedUnion('kind', [
  z.object({ ...MessageBase, kind: z.literal('user'), mode: InstructionTypeSchema }),
  z.object({
    ...MessageBase,
    kind: z.literal('agent'),
    mode: InstructionTypeSchema.optional(),
    isPlaceholder: z.boolean().optional(),
    placeholderState: z.enum(['thinking', 'waiting-for-user']).optional(),
    taskStatus: z.enum(['done', 'failed', 'stopped']).optional(),
  }),
  z.object({ ...MessageBase, kind: z.literal('system') }),
  z.object({
    ...MessageBase,
    kind: z.literal('screenAccess'),
    mode: InstructionTypeSchema,
    pendingContent: z.string(),
    screenShareStatus: z.enum(['allowed', 'denied']).optional(),
  }),
]);

export type StoredMessage = z.infer<typeof MessageSchema>;

const ChatContextSchema = z.object({
  chat_id: z.string().nullable().catch(null),
  messages: z
    .array(z.unknown())
    .catch([])
    .transform(items => items.flatMap(item => MessageSchema.safeParse(item).data ?? [])),
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

const warned = { read: false, write: false };

function warnOnce(kind: 'read' | 'write', message: string, error: unknown): void {
  if (warned[kind]) return;
  warned[kind] = true;
  logWarn(message, error);
}

export function readLocalParsed<T>(key: string, schema: z.ZodType<T>): T | undefined {
  let stored: string | null;
  try {
    stored = localStorage.getItem(key);
  } catch (error) {
    warnOnce('read', '[StorageService] localStorage is unreadable, degrading to memory for this session:', error);
    return undefined;
  }
  if (stored === null) return undefined;
  try {
    return schema.parse(JSON.parse(stored));
  } catch (error) {
    logWarn(`[StorageService] Ignoring an unreadable stored ${key}:`, error);
    return undefined;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    warnOnce('write', '[StorageService] localStorage is unwritable, degrading to memory for this session:', error);
  }
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

function sessionStore(action: (storage: Storage) => string | null | void): string | null {
  try {
    return action(sessionStorage) ?? null;
  } catch (error) {
    warnOnce('write', '[StorageService] sessionStorage is unusable, degrading to memory for this session:', error);
    return null;
  }
}

let tabId: string | null = null;

export function claimTabId(): string {
  if (tabId !== null) return tabId;
  tabId = sessionStore(storage => storage.getItem(TAB_ID_KEY)) ?? randomId();
  sessionStore(storage => storage.removeItem(TAB_ID_KEY));
  window.addEventListener('pagehide', () => sessionStore(storage => storage.setItem(TAB_ID_KEY, claimTabId())));
  window.addEventListener('pageshow', () => sessionStore(storage => storage.removeItem(TAB_ID_KEY)));
  return tabId;
}

export function remintTabId(): string {
  claimTabId();
  tabId = randomId();
  return tabId;
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
            parts: [{ type: 'text', content: 'Screen sharing ended' }],
          }
        : msg,
    ),
  });
}

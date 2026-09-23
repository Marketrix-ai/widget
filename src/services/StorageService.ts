/**
 * Browser-local persistence for the widget: the one door to `localStorage`.
 *
 * `readLocal`/`writeLocal` read and write a key, falling back to memory when a host page denies storage.
 * `scopedKey` suffixes a key by tenant so two tenants on one page never share state, and `scopeStorageTo`
 * points the chat context at one tenant. `getChatId`/`setChatId` hold the thread id and
 * `readChatSnapshot`/`writeChatSnapshot` the transcript. `MessageSchema` is the one definition of a chat
 * message, discriminated on `kind`. Nothing about the widget's config or credentials is ever persisted.
 *
 * A transcript older than a week is discarded, and a stored context is parsed field by field, so one
 * corrupted field falls back to its default rather than discarding the whole transcript.
 */
import { z } from 'zod';

import { InstructionTypeSchema } from '../sdk/contracts/entities';
import type { ChatMessage, InstructionType, ValidWidgetConfig } from '../types';
import { logWarn } from '../utils/log';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const MessagePartSchema = z.object({
  type: z.enum(['text', 'progress']),
  content: z.string(),
  status: z.enum(['in_progress', 'completed', 'failed']).optional(),
  browserToolName: z.string().optional(),
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

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    warnOnce('read', '[StorageService] localStorage is unreadable, degrading to memory for this session:', error);
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    warnOnce('write', '[StorageService] localStorage is unwritable, degrading to memory for this session:', error);
  }
}

function loadContext(key: string): ChatContext {
  const empty = ChatContextSchema.parse({});
  const stored = readLocal(key);
  if (!stored) return empty;
  try {
    const parsed = ChatContextSchema.parse(JSON.parse(stored));
    if (Date.now() - parsed.timestamp <= CONTEXT_EXPIRY_MS) return parsed;
  } catch (error) {
    logWarn('[StorageService] Failed to parse the stored context:', error);
  }
  return empty;
}

let contextKey = STORAGE_KEY;
let context = loadContext(contextKey);

function updateContext(updates: Partial<ChatContext>): void {
  context = { ...context, ...updates, timestamp: Date.now() };
  writeLocal(contextKey, JSON.stringify(context));
}

export function scopeStorageTo(config: Pick<ValidWidgetConfig, 'mtxId'>): void {
  contextKey = scopedKey(STORAGE_KEY, config);
  context = loadContext(contextKey);
}

export const getChatId = (): string | null => context.chat_id;

export const setChatId = (chatId: string): void => updateContext({ chat_id: chatId });

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

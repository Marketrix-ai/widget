/**
 * Browser-local persistence for the widget: the one door to `localStorage`, behind the `storageService`
 * singleton.
 *
 * `readLocal`/`writeLocal` read and write a key, falling back to memory when a host page denies storage.
 * `scopedKey` suffixes a key by tenant so two tenants on one page never share state, and `scopeTo` points
 * the chat context at one tenant. `writeChatSnapshot`/`readChatSnapshot` persist and restore the
 * transcript. Nothing about the widget's config or credentials is ever persisted.
 *
 * A transcript older than a week is discarded, and a stored context is parsed field by field, so one
 * corrupted field falls back to its default rather than discarding the whole transcript.
 */
import { z } from 'zod';

import { InstructionTypeSchema } from '../sdk/contracts/entities';
import type { ChatMessage, InstructionType, MarketrixConfig } from '../types';
import { logWarn } from '../utils/log';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const StoredMessageSchema = z.object({
  id: z.string(),
  kind: z.enum(['user', 'agent', 'system', 'screenAccess', 'screenshare']),
  timestamp: z.string(),
  parts: z.array(
    z.object({
      type: z.enum(['text', 'progress']),
      content: z.string(),
      status: z.enum(['in_progress', 'completed', 'failed']).optional(),
      browserToolName: z.string().optional(),
      streaming: z.boolean().optional(),
    }),
  ),
  mode: InstructionTypeSchema.optional(),
  isPlaceholder: z.boolean().optional(),
  placeholderState: z.enum(['thinking', 'waiting-for-user']).optional(),
  taskStatus: z.enum(['done', 'failed', 'stopped']).optional(),
  screenShareStatus: z.enum(['allowed', 'denied']).optional(),
  pendingContent: z.string().optional(),
});

export type StoredMessage = z.infer<typeof StoredMessageSchema>;

const ChatContextSchema = z.object({
  chat_id: z.string().nullable().catch(null),
  messages: z
    .array(z.unknown())
    .catch([])
    .transform(items => items.flatMap(item => StoredMessageSchema.safeParse(item).data ?? [])),
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

export function scopedKey(name: string, config: MarketrixConfig): string {
  return `${name}_${config.mtxId ?? 'default'}`;
}

const warned = { read: false, write: false };

function warnOnce(kind: 'read' | 'write', message: string, error: unknown): void {
  if (warned[kind]) return;
  warned[kind] = true;
  logWarn(message, error);
}

export function resetStorageWarningsForTests(): void {
  warned.read = false;
  warned.write = false;
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

class StorageService {
  private key = STORAGE_KEY;
  private context = loadContext(this.key);

  getContext(): ChatContext {
    return this.context;
  }

  updateContext(updates: Partial<ChatContext>): void {
    this.context = { ...this.context, ...updates, timestamp: Date.now() };
    writeLocal(this.key, JSON.stringify(this.context));
  }

  getChatId(): string | null {
    return this.context.chat_id;
  }

  setChatId(chatId: string): void {
    this.updateContext({ chat_id: chatId });
  }

  scopeTo(config: MarketrixConfig): void {
    this.key = scopedKey(STORAGE_KEY, config);
    this.context = loadContext(this.key);
  }
}

export const storageService = new StorageService();

export function readChatSnapshot(): ChatSnapshot {
  const { messages, currentMode, isOpen } = storageService.getContext();
  return { currentMode, isOpen, messages: messages.map(msg => ({ ...msg, timestamp: new Date(msg.timestamp) })) };
}

export function writeChatSnapshot(snapshot: ChatSnapshot): void {
  storageService.updateContext({
    ...snapshot,
    messages: snapshot.messages.map(({ videoStream, ...msg }): StoredMessage => {
      const timestamp = msg.timestamp.toISOString();
      if (!videoStream) return { ...msg, timestamp };
      return { ...msg, timestamp, kind: 'system', parts: [{ type: 'text', content: 'Screen sharing ended' }] };
    }),
  });
}

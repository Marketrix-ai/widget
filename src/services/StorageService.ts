/**
 * Browser-local persistence for the widget: the one door to `localStorage`, behind the
 * `storageService` singleton.
 *
 * `readLocal`/`writeLocal` read and write a key, falling back to memory when a host page denies
 * storage. `scopedKey` suffixes a key by tenant so two tenants on one page never share state.
 * `loadContext`/`setConfig`/`updateContext` manage the per-tenant chat context; `writeChatSnapshot`/
 * `readChatSnapshot` persist and restore the transcript. `getCredentialedConfig` needs both credentials.
 *
 * A transcript older than a week is discarded, and a corrupted stored context falls back
 * field-by-field to defaults rather than being thrown away whole.
 */
import {
  type ChatMessage,
  type InstructionType,
  type MarketrixConfig,
  messageText,
  type ValidWidgetConfig,
} from '../types';
import { logWarn } from '../utils/log';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string; content: string };

export interface ChatSnapshot {
  messages: ChatMessage[];
  currentMode: InstructionType;
  isOpen: boolean;
}

export type CredentialedConfig = ValidWidgetConfig & { mtxId: string; mtxKey: string };

type MarketrixChatContext = Omit<ChatSnapshot, 'messages'> & {
  chat_id: string | null;
  messages: StoredMessage[];
  config: MarketrixConfig | null;
  timestamp: number;
};

export function tenantScope(config: MarketrixConfig): string {
  return config.mtxId ?? (config.mtxApp != null ? String(config.mtxApp) : 'default');
}

export function scopedKey(name: string, config: MarketrixConfig): string {
  return `${name}_${tenantScope(config)}`;
}

const DEFAULT_CONTEXT: MarketrixChatContext = {
  chat_id: null,
  messages: [],
  currentMode: 'tell',
  isOpen: false,
  config: null,
  timestamp: 0,
};

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
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch (error) {
    warnOnce('read', '[StorageService] localStorage is unreadable, degrading to memory for this session:', error);
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch (error) {
    warnOnce('write', '[StorageService] localStorage is unwritable, degrading to memory for this session:', error);
  }
}

function isStoredMessage(value: unknown): value is StoredMessage {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (
    typeof msg['id'] === 'string' &&
    typeof msg['content'] === 'string' &&
    (msg['sender'] === 'user' || msg['sender'] === 'agent') &&
    typeof msg['timestamp'] === 'string' &&
    Array.isArray(msg['parts'])
  );
}

function sanitizeStoredContext(value: unknown): MarketrixChatContext {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_CONTEXT };
  const parsed = value as Record<string, unknown>;
  const chatId = parsed['chat_id'];
  const currentMode = parsed['currentMode'];
  const config = parsed['config'];
  const timestamp = parsed['timestamp'];
  return {
    chat_id: typeof chatId === 'string' || chatId === null ? chatId : DEFAULT_CONTEXT.chat_id,
    messages: Array.isArray(parsed['messages']) ? parsed['messages'].filter(isStoredMessage) : DEFAULT_CONTEXT.messages,
    currentMode:
      currentMode === 'tell' || currentMode === 'show' || currentMode === 'do'
        ? currentMode
        : DEFAULT_CONTEXT.currentMode,
    isOpen: typeof parsed['isOpen'] === 'boolean' ? parsed['isOpen'] : DEFAULT_CONTEXT.isOpen,
    config: typeof config === 'object' ? (config as MarketrixConfig | null) : DEFAULT_CONTEXT.config,
    timestamp: typeof timestamp === 'number' ? timestamp : DEFAULT_CONTEXT.timestamp,
  };
}

function loadContext(key: string): MarketrixChatContext {
  const stored = readLocal(key);
  if (!stored) return { ...DEFAULT_CONTEXT };
  try {
    const parsed = sanitizeStoredContext(JSON.parse(stored));
    if (Date.now() - parsed.timestamp <= CONTEXT_EXPIRY_MS) return parsed;
  } catch (error) {
    logWarn('[StorageService] Failed to parse the stored context:', error);
  }
  return { ...DEFAULT_CONTEXT };
}

class StorageService {
  private key = STORAGE_KEY;
  private context = loadContext(this.key);

  getContext(): MarketrixChatContext {
    return this.context;
  }

  updateContext(updates: Partial<MarketrixChatContext>): void {
    this.context = { ...this.context, ...updates, timestamp: Date.now() };
    writeLocal(this.key, JSON.stringify(this.context));
  }

  getChatId(): string | null {
    return this.context.chat_id;
  }

  setChatId(chatId: string): void {
    this.updateContext({ chat_id: chatId });
  }

  getCredentialedConfig(): CredentialedConfig | null {
    const { config } = this.context;
    return config?.mtxId && config.mtxKey ? (config as CredentialedConfig) : null;
  }

  setConfig(config: CredentialedConfig): void {
    this.key = scopedKey(STORAGE_KEY, config);
    this.context = loadContext(this.key);
    this.updateContext({ config });
  }
}

export const storageService = new StorageService();

export function readChatSnapshot(): ChatSnapshot {
  const { chat_id: _chatId, config: _config, timestamp: _timestamp, messages, ...rest } = storageService.getContext();
  return {
    ...rest,
    messages: messages.map(({ content, ...msg }): ChatMessage => {
      const parts = [...msg.parts];
      const text = content.trim();
      if (parts.length === 0 && text) parts.push({ type: 'text', content: text });
      return { ...msg, timestamp: new Date(msg.timestamp), parts };
    }),
  };
}

export function writeChatSnapshot(snapshot: ChatSnapshot): void {
  storageService.updateContext({
    ...snapshot,
    messages: snapshot.messages.map(({ videoStream, ...msg }): StoredMessage => {
      const timestamp = msg.timestamp.toISOString();
      if (!videoStream) return { ...msg, timestamp, content: messageText(msg.parts) };
      const content = 'Screen sharing ended';
      return { ...msg, timestamp, content, isSystemMessage: true, parts: [{ type: 'text', content }] };
    }),
  });
}

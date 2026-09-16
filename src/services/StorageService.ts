/**
 * Browser-local persistence for the widget: the one door to `localStorage`, and the per-tenant chat
 * context (chat_id, transcript, composer mode, open state, resolved config) behind the `storageService`
 * singleton. `tenantScope` (credential id, else application id, else `default`) is the scope suffix every
 * browser-local key shares via `scopedKey`, so the chat-context, drag-position and resize keys all
 * partition by tenant identically. `readLocal`/`writeLocal` are the only `localStorage` access in `src/`;
 * a host page can deny storage outright (third-party cookies off, sandboxed iframe), so both degrade to
 * a warn and the widget keeps working unpersisted.
 *
 * `loadContext` merges one parsed key over `DEFAULT_CONTEXT`, so an older widget version's payload reads
 * as incomplete rather than corrupt, and discards anything past `CONTEXT_EXPIRY_MS` (7 days).
 * `getCredentialedConfig` is null unless both `mtxId` and `mtxKey` are present, so callers cannot
 * dispatch half-credentialed. `setConfig` re-keys storage to `${STORAGE_KEY}_${tenantScope}` and reloads
 * from it, since without that two applications on one origin would leak one tenant's transcript into
 * another's.
 *
 * The chat snapshot is `{messages, currentMode, isOpen}` — chat_id, config and timestamp are deliberately
 * excluded. Reading revives `timestamp` to a `Date` and backfills a text part for messages stored before
 * `parts` existed; writing drops `videoStream` (unserializable, dead on reload), rewriting it as "Screen
 * sharing ended".
 *
 * `sanitizeStoredContext` is hand-rolled, not zod, per the package-level rule that a schema imported as a
 * VALUE anywhere reachable from `src/index.tsx` pulls zod's whole runtime into the bundle. Each field
 * falls back to `DEFAULT_CONTEXT`'s value individually, so a partially-corrupt payload keeps the fields
 * that DID parse rather than discarding the whole context.
 */
import type { ChatMessage, InstructionType, MarketrixConfig, ValidWidgetConfig } from '../types';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string };

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

export function readLocal(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch (error) {
    console.warn('[StorageService] localStorage is unreadable:', error);
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch (error) {
    console.warn('[StorageService] localStorage is unwritable:', error);
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
    console.warn('[StorageService] Failed to parse the stored context:', error);
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
    messages: messages.map((msg): ChatMessage => {
      const parts = [...msg.parts];
      const text = msg.content.trim();
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
      if (!videoStream) return { ...msg, timestamp };
      const content = 'Screen sharing ended';
      return { ...msg, timestamp, content, isSystemMessage: true, parts: [{ type: 'text', content }] };
    }),
  });
}

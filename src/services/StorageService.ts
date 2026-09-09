/**
 * Browser-local persistence for the widget: the one door to `localStorage`, and the per-tenant chat
 * context (chat_id, transcript, composer mode, open state, resolved config) behind the `storageService`
 * singleton.
 *
 * Contents: `tenantScope`, the scope suffix for every browser-local key — the credential id, else the
 * application id, else `default`; it is shared with the drag-position and resize keys, so all of them
 * partition the same way · `readLocal` / `writeLocal`, the only `localStorage` access in `src/` — a host
 * page can deny storage outright (third-party cookies off, sandboxed iframe) where even *reading* throws,
 * so both degrade to a warn and the widget keeps working unpersisted rather than breaking the customer's
 * page · `loadContext`, which parses one key merged over `DEFAULT_CONTEXT` so a payload written by an older
 * widget version reads as incomplete rather than corrupt, and discards anything older than
 * `CONTEXT_EXPIRY_MS` (7 days) · `StorageService` and its singleton `storageService` — `getContext`,
 * `updateContext` (merges, restamps `timestamp`, writes through), `getChatId` / `setChatId`,
 * `getCredentialedConfig` (null unless both `mtxId` and `mtxKey` are present, so callers cannot dispatch
 * half-credentialed) and `setConfig` · `readChatSnapshot` / `writeChatSnapshot`, the UI-facing view of the
 * context.
 *
 * `setConfig` re-keys storage to `${STORAGE_KEY}_${tenantScope}` and reloads from that key: without it two
 * applications embedded on one origin would share a stored chat_id and one tenant's transcript would leak
 * into another's.
 *
 * The snapshot is `{messages, currentMode, isOpen}` — chat_id, config and timestamp are deliberately not
 * part of it. Reading revives `timestamp` to a `Date` and backfills a text part from `content` for messages
 * stored before `parts` existed, so `messageText` is not empty for them. Writing drops `videoStream`, which
 * is not serializable and is dead on reload anyway, and rewrites that message as the `Screenshare ended`
 * system line.
 */
import type { ChatMessage, InstructionType, MarketrixConfig, ValidWidgetConfig } from '../types';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string };

export interface ChatSnapshot {
  messages: ChatMessage[];
  currentMode: InstructionType;
  isOpen: boolean;
}

export type CredentialedConfig = ValidWidgetConfig & { mtxId: string; mtxKey: string };

export type MarketrixChatContext = Omit<ChatSnapshot, 'messages'> & {
  chat_id: string | null;
  messages: StoredMessage[];
  config: MarketrixConfig | null;
  timestamp: number;
};

export function tenantScope(config: MarketrixConfig): string {
  return config.mtxId ?? (config.mtxApp != null ? String(config.mtxApp) : 'default');
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

function loadContext(key: string): MarketrixChatContext {
  const stored = readLocal(key);
  if (!stored) return { ...DEFAULT_CONTEXT };
  try {
    const parsed = { ...DEFAULT_CONTEXT, ...(JSON.parse(stored) as Partial<MarketrixChatContext>) };
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
    this.key = `${STORAGE_KEY}_${tenantScope(config)}`;
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
      const content = 'Screenshare ended';
      return { ...msg, timestamp, content, isSystemMessage: true, parts: [{ type: 'text', content }] };
    }),
  });
}

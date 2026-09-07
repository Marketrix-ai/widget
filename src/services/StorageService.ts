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

/** Per-tenant scope for browser-local keys: the credential id, else the application id. */
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

// A host page can deny storage outright (third-party cookies off, sandboxed iframe), where even reading throws.
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

// Merged over the defaults so a payload written by an older widget version reads as incomplete, not corrupt.
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

  // Scopes the chat transcript/chat_id to the tenant — without this, two applications embedded on one
  // origin would share a stored chat_id and one tenant's transcript would leak into another's.
  setConfig(config: CredentialedConfig): void {
    this.key = `${STORAGE_KEY}_${tenantScope(config)}`;
    this.context = loadContext(this.key);
    this.updateContext({ config });
  }
}

export const storageService = new StorageService();

function reviveMessage(msg: StoredMessage): ChatMessage {
  const parts = [...msg.parts];
  const text = msg.content.trim();
  if (parts.length === 0 && text) parts.push({ type: 'text', content: text });
  return { ...msg, timestamp: new Date(msg.timestamp), parts };
}

function serializeMessage({ videoStream, ...msg }: ChatMessage): StoredMessage {
  const timestamp = msg.timestamp.toISOString();
  if (!videoStream) return { ...msg, timestamp };
  const content = 'Screenshare ended';
  return { ...msg, timestamp, content, isSystemMessage: true, parts: [{ type: 'text', content }] };
}

export function readChatSnapshot(): ChatSnapshot {
  const { chat_id: _chatId, config: _config, timestamp: _timestamp, messages, ...rest } = storageService.getContext();
  return { ...rest, messages: messages.map(reviveMessage) };
}

export function writeChatSnapshot(snapshot: ChatSnapshot): void {
  storageService.updateContext({ ...snapshot, messages: snapshot.messages.map(serializeMessage) });
}

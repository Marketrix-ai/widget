import type { ChatMessage, InstructionType, MarketrixConfig } from '../types';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string };

export interface ChatSnapshot {
  messages: ChatMessage[];
  currentMode: InstructionType;
  isOpen: boolean;
}

export type CredentialedConfig = MarketrixConfig & { mtxId: string; mtxKey: string };

export type MarketrixChatContext = Omit<ChatSnapshot, 'messages'> & {
  chat_id: string | null;
  messages: StoredMessage[];
  config: MarketrixConfig | null;
  timestamp: number;
};

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
function loadContext(): MarketrixChatContext {
  const stored = readLocal(STORAGE_KEY);
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
  private context = loadContext();

  getContext(): MarketrixChatContext {
    return this.context;
  }

  updateContext(updates: Partial<MarketrixChatContext>): void {
    this.context = { ...this.context, ...updates, timestamp: Date.now() };
    writeLocal(STORAGE_KEY, JSON.stringify(this.context));
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
    this.updateContext({ config });
  }
}

export const storageService = new StorageService();

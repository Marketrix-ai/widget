import type { ChatMessage, InstructionType, MarketrixConfig } from '../types';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string };

/** The durable half of the widget's React state. `isLoading` is deliberately absent — restoring it would
 * leave the FAB glowing for a request that died with the previous page. */
export interface ChatSnapshot {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  activeTaskId: string | null;
  currentMode: InstructionType;
  isOpen: boolean;
}

export type MarketrixChatContext = Omit<ChatSnapshot, 'messages'> & {
  chat_id: string | null;
  messages: StoredMessage[];
  config: MarketrixConfig | null;
  timestamp: number;
};

const DEFAULT_CONTEXT: MarketrixChatContext = {
  chat_id: null,
  messages: [],
  isTaskRunning: false,
  activeTaskId: null,
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

  /** window.name takes priority over localStorage — it is what survives host-page navigation. */
  getChatId(): string | null {
    const windowChatId = typeof window === 'undefined' ? '' : window.name;
    if (!windowChatId.trim()) return this.context.chat_id;
    if (windowChatId !== this.context.chat_id) this.updateContext({ chat_id: windowChatId });
    return windowChatId;
  }

  setChatId(chatId: string): void {
    this.updateContext({ chat_id: chatId });
    if (typeof window !== 'undefined') window.name = chatId;
  }

  getConfig(): MarketrixConfig | null {
    return this.context.config;
  }

  setConfig(config: MarketrixConfig): void {
    this.updateContext({ config });
  }
}

export const storageService = new StorageService();

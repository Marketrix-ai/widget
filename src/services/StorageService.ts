import type { ChatMessage, InstructionType, MarketrixConfig } from '../types';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string };

/** The live half of the persisted context: exactly what the widget's three React stores hold between them. */
export interface ChatSnapshot {
  messages: ChatMessage[];
  isTaskRunning: boolean;
  activeTaskId: string | null;
  currentMode: InstructionType;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
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
  isMinimized: false,
  isLoading: false,
  config: null,
  timestamp: 0,
};

// Merged over the defaults so a payload written by an older widget version reads as incomplete, not corrupt.
function loadContext(): MarketrixChatContext {
  if (typeof window === 'undefined') return { ...DEFAULT_CONTEXT };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = { ...DEFAULT_CONTEXT, ...(JSON.parse(stored) as Partial<MarketrixChatContext>) };
      if (Date.now() - parsed.timestamp <= CONTEXT_EXPIRY_MS) return parsed;
    }
  } catch (error) {
    console.warn('[StorageService] Failed to load context:', error);
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
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.context));
    } catch (error) {
      console.error('[StorageService] Failed to save context:', error);
    }
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

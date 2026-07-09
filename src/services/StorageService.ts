/**
 * Unified widget localStorage under a single key (`marketrix_chat_context`): chat_id, messages, widget state, config.
 *
 * **Canonical implementation** of the `StorageService` mirror pair — the widget owns the read/write
 * lifecycle; `app/src/services/StorageService.ts` must stay byte-identical (modulo its `'../types'`
 * import path). Change storage semantics here first, then copy over to the app mirror.
 */

import type { ChatMessage, InstructionType, MarketrixConfig } from '../types';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Serializable ChatMessage: timestamp as string, no videoStream. */
type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string };

export interface MarketrixChatContext {
  chat_id: string | null;

  messages: StoredMessage[];
  isSimulationRunning: boolean;
  activeSimulationId: string | null;
  currentMode: InstructionType;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;

  config: MarketrixConfig | null;

  timestamp: number;
}

const DEFAULT_CONTEXT: MarketrixChatContext = {
  chat_id: null,
  messages: [],
  isSimulationRunning: false,
  activeSimulationId: null,
  currentMode: 'tell',
  isOpen: false,
  isMinimized: false,
  isLoading: false,
  config: null,
  timestamp: Date.now(),
};

/** Singleton wrapper around `localStorage` for the unified widget chat context. Canonical — see file header. */
class StorageService {
  private static instance: StorageService;
  private context: MarketrixChatContext | null = null;

  private constructor() {
    this.loadContext();
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private loadContext(): MarketrixChatContext {
    if (typeof window === 'undefined') {
      this.context = { ...DEFAULT_CONTEXT };
      return this.context;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MarketrixChatContext;

        if (Date.now() - parsed.timestamp > CONTEXT_EXPIRY_MS) {
          this.context = { ...DEFAULT_CONTEXT };
          this.saveContext();
          return this.context;
        }

        this.context = parsed;
        return this.context;
      }
    } catch (error) {
      console.warn('[StorageService] Failed to load context:', error);
    }

    this.context = { ...DEFAULT_CONTEXT };
    return this.context;
  }

  private saveContext(): void {
    if (typeof window === 'undefined' || !this.context) {
      return;
    }

    try {
      this.context.timestamp = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.context));
    } catch (error) {
      console.error('[StorageService] Failed to save context:', error);
    }
  }

  getContext(): MarketrixChatContext {
    if (!this.context) {
      return this.loadContext();
    }
    return this.context;
  }

  updateContext(updates: Partial<MarketrixChatContext>): void {
    if (!this.context) {
      this.loadContext();
    }
    const currentContext = this.context as MarketrixChatContext;
    this.context = { ...currentContext, ...updates };
    this.saveContext();
  }

  private isValidChatId(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim() !== '';
  }

  /** window.name takes priority over localStorage — it persists across page navigations. */
  getChatId(): string | null {
    if (typeof window !== 'undefined' && this.isValidChatId(window.name)) {
      const windowChatId = window.name;
      const storedChatId = this.getContext().chat_id;

      if (windowChatId !== storedChatId) {
        this.updateContext({ chat_id: windowChatId });
      }
      return windowChatId;
    }

    return this.getContext().chat_id;
  }

  /** Dispatches a 'marketrix:chatid' event so other services (e.g. RrwebSessionRecorder) can react. */
  setChatId(chatId: string | null): void {
    this.updateContext({ chat_id: chatId });

    if (typeof window !== 'undefined' && chatId) {
      window.name = chatId;
      window.dispatchEvent(new CustomEvent('marketrix:chatid', { detail: { chatId } }));
    }
  }

  getMessages(): StoredMessage[] {
    return this.getContext().messages;
  }

  setMessages(messages: StoredMessage[]): void {
    this.updateContext({ messages });
  }

  getChatState(): Pick<
    MarketrixChatContext,
    'isSimulationRunning' | 'activeSimulationId' | 'currentMode' | 'isOpen' | 'isMinimized' | 'isLoading'
  > {
    const ctx = this.getContext();
    return {
      isSimulationRunning: ctx.isSimulationRunning,
      activeSimulationId: ctx.activeSimulationId,
      currentMode: ctx.currentMode,
      isOpen: ctx.isOpen,
      isMinimized: ctx.isMinimized,
      isLoading: ctx.isLoading,
    };
  }

  setChatState(
    state: Partial<
      Pick<
        MarketrixChatContext,
        'isSimulationRunning' | 'activeSimulationId' | 'currentMode' | 'isOpen' | 'isMinimized' | 'isLoading'
      >
    >,
  ): void {
    this.updateContext(state);
  }

  getConfig(): MarketrixConfig | null {
    return this.getContext().config;
  }

  setConfig(config: MarketrixConfig | null): void {
    this.updateContext({ config });
  }

  clear(): void {
    this.context = { ...DEFAULT_CONTEXT };
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  hasValidContext(): boolean {
    const ctx = this.getContext();
    return ctx.chat_id !== null && ctx.chat_id.length > 0;
  }
}

export const storageService = StorageService.getInstance();

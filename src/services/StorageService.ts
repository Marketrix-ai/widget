/**
 * StorageService - Unified localStorage management for widget
 *
 * Consolidates all widget localStorage into a single key: marketrix_chat_context
 * Contains: chat_id, messages, widget state, and config
 *
 * **Canonical implementation.** This file is the source of truth for the
 * `StorageService` mirror pair. The matching `app/src/services/StorageService.ts`
 * in the dashboard repo should be byte-identical to this file (modulo its
 * own `'../types'` import path). When updating storage semantics, change
 * this file first and copy the result over to the app mirror.
 *
 * Why widget is canonical: the chat context object (chat_id, messages,
 * task progress, widget config) originates in the embeddable widget — the
 * widget owns the read/write lifecycle, and the dashboard only ever reads
 * the same shape for parity.
 */

import type { ChatMessage, InstructionType, MarketrixConfig } from '../types';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Serializable version of ChatMessage (timestamp as string, no videoStream)
 */
type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string };

export interface MarketrixChatContext {
  chat_id: string | null;

  messages: StoredMessage[];
  isTaskRunning: boolean;
  activeTaskId: string | null;
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
  isTaskRunning: false,
  activeTaskId: null,
  currentMode: 'tell',
  isOpen: false,
  isMinimized: false,
  isLoading: false,
  config: null,
  timestamp: Date.now(),
};

/**
 * Singleton wrapper around `localStorage` for the unified widget chat context.
 *
 * Canonical implementation — see file header. Mirror in `app/src/services/StorageService.ts`
 * must be byte-identical (modulo the relative path of the `../types` import).
 */
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

  /**
   * Get chat_id with window.name fallback for cross-page navigation
   * Priority: window.name (if valid) -> localStorage
   */
  getChatId(): string | null {
    // First check window.name for chat_id (persists across page navigations)
    if (typeof window !== 'undefined' && this.isValidChatId(window.name)) {
      const windowChatId = window.name;
      const storedChatId = this.getContext().chat_id;

      // If window.name has a valid chat_id different from localStorage, update localStorage
      if (windowChatId !== storedChatId) {
        this.updateContext({ chat_id: windowChatId });
      }
      return windowChatId;
    }

    // Fall back to localStorage
    return this.getContext().chat_id;
  }

  /**
   * Set chat_id in both localStorage and window.name.
   * Dispatches a 'marketrix:chatid' event so other services (e.g. SessionRecorder) can react.
   */
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
    'isTaskRunning' | 'activeTaskId' | 'currentMode' | 'isOpen' | 'isMinimized' | 'isLoading'
  > {
    const ctx = this.getContext();
    return {
      isTaskRunning: ctx.isTaskRunning,
      activeTaskId: ctx.activeTaskId,
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
        'isTaskRunning' | 'activeTaskId' | 'currentMode' | 'isOpen' | 'isMinimized' | 'isLoading'
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

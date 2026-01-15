/**
 * StorageService - Unified localStorage management for widget
 *
 * Consolidates all widget localStorage into a single key: marketrix_chat_context
 * Contains: chat_id, messages, widget state, and config
 */

import type { ChatMessage, InstructionType, MarketrixConfig, TaskProgress } from '../types';

const STORAGE_KEY = 'marketrix_chat_context';
const CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Serializable version of ChatMessage (timestamp as string, no videoStream)
 */
type StoredMessage = Omit<ChatMessage, 'videoStream' | 'timestamp'> & { timestamp: string };

/**
 * Unified storage structure for all widget data
 */
export interface MarketrixChatContext {
  // Chat session
  chat_id: string | null;

  // Chat state
  messages: StoredMessage[];
  isTaskRunning: boolean;
  activeTaskId: string | null;
  taskProgress: TaskProgress[];
  currentMode: InstructionType;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;

  // Widget config
  config: MarketrixConfig | null;

  // Metadata
  timestamp: number;
}

/**
 * Default empty context
 */
const DEFAULT_CONTEXT: MarketrixChatContext = {
  chat_id: null,
  messages: [],
  isTaskRunning: false,
  activeTaskId: null,
  taskProgress: [],
  currentMode: 'tell',
  isOpen: false,
  isMinimized: false,
  isLoading: false,
  config: null,
  timestamp: Date.now(),
};

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

  /**
   * Load context from localStorage
   */
  private loadContext(): MarketrixChatContext {
    if (typeof localStorage === 'undefined') {
      this.context = { ...DEFAULT_CONTEXT };
      return this.context;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MarketrixChatContext;

        // Check if expired
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

  /**
   * Save context to localStorage
   */
  private saveContext(): void {
    if (typeof localStorage === 'undefined' || !this.context) {
      return;
    }

    try {
      this.context.timestamp = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.context));
    } catch (error) {
      console.error('[StorageService] Failed to save context:', error);
    }
  }

  /**
   * Get the full context
   */
  getContext(): MarketrixChatContext {
    if (!this.context) {
      return this.loadContext();
    }
    return this.context;
  }

  /**
   * Update context with partial data
   */
  updateContext(updates: Partial<MarketrixChatContext>): void {
    if (!this.context) {
      this.loadContext();
    }
    this.context = { ...this.context!, ...updates };
    this.saveContext();
  }

  // ========== Chat ID ==========

  getChatId(): string | null {
    return this.getContext().chat_id;
  }

  setChatId(chatId: string | null): void {
    this.updateContext({ chat_id: chatId });
  }

  // ========== Messages ==========

  getMessages(): StoredMessage[] {
    return this.getContext().messages;
  }

  setMessages(messages: StoredMessage[]): void {
    this.updateContext({ messages });
  }

  // ========== Chat State ==========

  getChatState(): Pick<
    MarketrixChatContext,
    'isTaskRunning' | 'activeTaskId' | 'taskProgress' | 'currentMode' | 'isOpen' | 'isMinimized' | 'isLoading'
  > {
    const ctx = this.getContext();
    return {
      isTaskRunning: ctx.isTaskRunning,
      activeTaskId: ctx.activeTaskId,
      taskProgress: ctx.taskProgress,
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
        'isTaskRunning' | 'activeTaskId' | 'taskProgress' | 'currentMode' | 'isOpen' | 'isMinimized' | 'isLoading'
      >
    >,
  ): void {
    this.updateContext(state);
  }

  // ========== Config ==========

  getConfig(): MarketrixConfig | null {
    return this.getContext().config;
  }

  setConfig(config: MarketrixConfig | null): void {
    this.updateContext({ config });
  }

  // ========== Clear ==========

  clear(): void {
    this.context = { ...DEFAULT_CONTEXT };
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Check if context exists and has a valid chat_id
   */
  hasValidContext(): boolean {
    const ctx = this.getContext();
    return ctx.chat_id !== null && ctx.chat_id.length > 0;
  }
}

export const storageService = StorageService.getInstance();

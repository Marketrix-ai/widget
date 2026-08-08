import { sdk } from '../sdk';
import { createLogger } from '../utils/logger';
import { chatService } from './ChatService';
import { storageService } from './StorageService';

const log = createLogger('ChatSessionManager');

class ChatSessionManager {
  private static instance: ChatSessionManager | null = null;
  private chatId: string | null = null;
  private initializationPromise: Promise<string> | null = null;

  private constructor() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.chatId = this.getStoredChatId();
    if (this.chatId) {
      log.debug('Loaded existing chat ID from storage:', this.chatId);
    }
  }

  static getInstance(): ChatSessionManager {
    // Under SSR, bypass the constructor entirely so no browser API is touched.
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      if (!ChatSessionManager.instance) {
        ChatSessionManager.instance = Object.create(ChatSessionManager.prototype) as ChatSessionManager;
        ChatSessionManager.instance.chatId = null;
        ChatSessionManager.instance.initializationPromise = null;
      }
      return ChatSessionManager.instance;
    }

    if (!ChatSessionManager.instance) {
      ChatSessionManager.instance = new ChatSessionManager();
    }
    return ChatSessionManager.instance;
  }

  getChatId(): string | null {
    return this.chatId;
  }

  /** Promise-based lock: concurrent callers all await the same creation promise. */
  async getOrCreateChatId(): Promise<string> {
    if (this.chatId) {
      log.debug('Returning existing chat ID:', this.chatId);
      return this.chatId;
    }

    if (this.initializationPromise) {
      log.debug('Chat ID initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // Re-check storage in case another instance set it meanwhile.
    const storedChatId = this.getStoredChatId();
    if (storedChatId) {
      this.chatId = storedChatId;
      log.debug('Found chat ID in storage:', this.chatId);
      return this.chatId;
    }

    this.initializationPromise = this.createChatId();

    try {
      const newChatId = await this.initializationPromise;
      return newChatId;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async createChatId(): Promise<string> {
    try {
      log.info('Creating new chat ID...');
      const chatId = await sdk.chatCreate(undefined);
      if (!chatId) {
        throw new Error('API returned empty chat ID');
      }

      this.chatId = chatId;
      this.storeChatId(chatId);
      log.info('Created and stored new chat ID:', this.chatId);

      chatService.createInitialContext(chatId);

      return chatId;
    } catch (error) {
      log.error('Failed to create chat ID:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  private getStoredChatId(): string | null {
    return storageService.getChatId();
  }

  private storeChatId(id: string): void {
    storageService.setChatId(id);
  }
}

export const chatSessionManager = ChatSessionManager.getInstance();

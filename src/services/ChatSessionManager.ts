import { sdk } from '../sdk';
import { chatService } from './ChatService';
import { storageService } from './StorageService';

class ChatSessionManager {
  private chatId: string | null = null;
  private initializationPromise: Promise<string> | null = null;

  constructor() {
    // Runs at module load, so under SSR it must not reach storage; the field initializers are the idle state.
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.chatId = this.getStoredChatId();
    if (this.chatId) {
      console.debug('[ChatSessionManager] Loaded existing chat ID from storage:', this.chatId);
    }
  }

  getChatId(): string | null {
    return this.chatId;
  }

  /** Promise-based lock: concurrent callers all await the same creation promise. */
  async getOrCreateChatId(): Promise<string> {
    if (this.chatId) {
      console.debug('[ChatSessionManager] Returning existing chat ID:', this.chatId);
      return this.chatId;
    }

    if (this.initializationPromise) {
      console.debug('[ChatSessionManager] Chat ID initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // Re-check storage in case another instance set it meanwhile.
    const storedChatId = this.getStoredChatId();
    if (storedChatId) {
      this.chatId = storedChatId;
      console.debug('[ChatSessionManager] Found chat ID in storage:', this.chatId);
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
      console.info('[ChatSessionManager] Creating new chat ID...');
      const chatId = await sdk.chatCreate(undefined);
      if (!chatId) {
        throw new Error('API returned empty chat ID');
      }

      this.chatId = chatId;
      this.storeChatId(chatId);
      console.info('[ChatSessionManager] Created and stored new chat ID:', this.chatId);

      chatService.createInitialContext(chatId);

      return chatId;
    } catch (error) {
      console.error('[ChatSessionManager] Failed to create chat ID:', error);
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

export const chatSessionManager = new ChatSessionManager();

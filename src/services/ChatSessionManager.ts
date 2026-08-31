import { sdk } from '../sdk';
import { storageService } from './StorageService';

class ChatSessionManager {
  private creation: Promise<string> | null = null;

  /** Promise-based lock: concurrent callers all await the same creation. */
  async getOrCreateChatId(): Promise<string> {
    const stored = storageService.getChatId();
    if (stored) return stored;

    this.creation ??= this.createChatId().finally(() => {
      this.creation = null;
    });
    return this.creation;
  }

  private async createChatId(): Promise<string> {
    const chatId = await sdk.chatCreate(undefined);
    if (!chatId) throw new Error('API returned empty chat ID');
    storageService.setChatId(chatId);
    console.info('[ChatSessionManager] Created chat ID:', chatId);
    return chatId;
  }
}

export const chatSessionManager = new ChatSessionManager();

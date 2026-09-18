/**
 * The widget's chat-thread identity: `chatSessionManager` mints and reuses a visitor's `chat_id`.
 * `getOrCreateChatId` returns the id already in storage, or opens a new thread and persists it.
 *
 * Several callers (the stream connect, the rrweb recorder, and posting a message) ask for the id at
 * once on first load, so the in-flight creation is held as a lock: without it each would open its own
 * thread and end up listening and posting on different chats. A failed create clears the lock so the
 * next caller retries rather than being stuck with a cached rejection.
 */
import { sdk } from '../sdk';
import { storageService } from './StorageService';

class ChatSessionManager {
  private creation: Promise<string> | null = null;

  async getOrCreateChatId(): Promise<string> {
    const stored = storageService.getChatId();
    if (stored) return stored;

    this.creation ??= (async () => {
      const chatId = await sdk.chatCreate(undefined);
      if (!chatId) throw new Error('API returned empty chat ID');
      storageService.setChatId(chatId);
      return chatId;
    })().finally(() => {
      this.creation = null;
    });
    return this.creation;
  }
}

export const chatSessionManager = new ChatSessionManager();

/**
 * The widget's chat-thread identity: `chatSessionManager`, the one home for minting and reusing a visitor's
 * `chat_id`. `getOrCreateChatId` returns the id `storageService` already holds, otherwise opens a thread
 * through `sdk.chatCreate` (a procedure with no input — the oRPC client still demands the argument),
 * persists it and returns it.
 *
 * The in-flight `creation` promise is a lock. `InitBridge`'s stream connect, `index.tsx`'s rrweb recorder
 * and `chatPost` all ask for the id at once on first load; without it each would POST its own thread and the
 * stream would end up listening on a different chat than the messages are posted to. `finally` clears the
 * lock so a failed create is retried by the next caller rather than a rejected promise being cached for the
 * lifetime of the page.
 *
 * An empty id throws instead of being stored: the contract's output is a bare `z.string()`, so `''` passes
 * validation, and once persisted `getChatId()` reads falsy and every later caller re-mints forever.
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

/**
 * The widget's chat-thread identity: `getOrCreateChatId` returns the visitor's stored `chat_id`, or opens
 * a new thread and persists it.
 *
 * Several callers (the stream connect, the rrweb recorder, and posting a message) ask for the id at once
 * on first load, so the in-flight creation is shared: without it each would open its own thread and end up
 * listening and posting on different chats. A failed create is not cached, so the next caller retries.
 */
import { sdk } from '../sdk';
import { getChatId, setChatId } from './StorageService';

let creation: Promise<string> | null = null;

export function getOrCreateChatId(): Promise<string> {
  const stored = getChatId();
  if (stored) return Promise.resolve(stored);

  creation ??= (async () => {
    const chatId = await sdk.chatCreate(undefined);
    if (!chatId) throw new Error('API returned empty chat ID');
    setChatId(chatId);
    return chatId;
  })().finally(() => {
    creation = null;
  });
  return creation;
}

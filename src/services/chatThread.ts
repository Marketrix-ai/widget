/**
 * The widget's chat-thread identity: `getOrCreateChatId` returns the visitor's stored `chat_id`, or opens
 * a new thread and persists it. Concurrent first-load callers share one in-flight creation.
 */
import { sdk } from '../sdk';
import { getChatId, setChatId } from './StorageService';

let creation: Promise<string> | null = null;

export function getOrCreateChatId(): Promise<string> {
  const stored = getChatId();
  if (stored) return Promise.resolve(stored);

  creation ??= (async () => {
    const chatId = await sdk.chatCreate(undefined);
    setChatId(chatId);
    return chatId;
  })().finally(() => {
    creation = null;
  });
  return creation;
}

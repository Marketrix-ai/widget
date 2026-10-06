/**
 * Where a mounted widget's chat lives, injected by whoever mounts it. `liveTransport` carries the chat to the api
 * over `streamClient` and keeps the thread in storage; `createPreviewTransport` answers every turn with a canned
 * reply and keeps nothing, so a dashboard preview never mints a chat or touches a visitor's stored thread.
 */
import type { WidgetEvent } from '../sdk';
import { getOrCreateChatId } from './chatThread';
import { type ChatSnapshot, forgetChatId, readChatSnapshot, writeChatSnapshot } from './StorageService';
import { streamClient, type StreamState } from './StreamClient';

type StreamClient = typeof streamClient;

export interface ChatTransport {
  restore: () => ChatSnapshot;
  persist: (snapshot: ChatSnapshot) => void;
  open: (signal: AbortSignal) => Promise<void>;
  restart: () => Promise<void>;
  ready: () => Promise<void>;
  send: StreamClient['send'];
  route: StreamClient['route'];
  onEvent: StreamClient['onEvent'];
  subscribe: StreamClient['subscribe'];
  getState: StreamClient['getState'];
}

export const PREVIEW_REPLY = "This is a preview. In production, I'll respond to your messages here.";

export const liveTransport: ChatTransport = {
  restore: () => readChatSnapshot(),
  persist: snapshot => writeChatSnapshot(snapshot),
  open: async signal => {
    const chatId = await getOrCreateChatId();
    if (!signal.aborted) await streamClient.connect(chatId);
  },
  restart: async () => {
    forgetChatId();
    await streamClient.connect(await getOrCreateChatId());
  },
  ready: async () => streamClient.ready(await getOrCreateChatId()),
  send: (...args) => streamClient.send(...args),
  route: () => streamClient.route(),
  onEvent: handler => streamClient.onEvent(handler),
  subscribe: listener => streamClient.subscribe(listener),
  getState: () => streamClient.getState(),
};

const PREVIEW_STATE: StreamState = { phase: 'idle' };

export function createPreviewTransport(): ChatTransport {
  const handlers = new Set<(event: WidgetEvent) => void>();
  return {
    restore: () => ({ messages: [], currentMode: 'tell', isOpen: false }),
    persist: () => {},
    open: async () => {},
    restart: async () => {},
    ready: async () => {},
    send: async command => {
      if (!('content' in command)) return;
      const reply: WidgetEvent = { type: 'chat/response', request_id: command.request_id, text: PREVIEW_REPLY };
      queueMicrotask(() => handlers.forEach(handler => handler(reply)));
    },
    route: () => ({ chatId: null, tabId: '' }),
    onEvent: handler => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    subscribe: () => () => {},
    getState: () => PREVIEW_STATE,
  };
}

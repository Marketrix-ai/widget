/**
 * Singleton SSE transport between the widget and the api, exported as `streamClient`.
 * `setCredentials` holds the stream's credentials, `send` posts a command via `widgetMessagePost`, `ready`
 * connects and waits for registration, and `canReconnect`/`reconnectNow` back Retry; `StreamGaveUpError`
 * marks a stream that exhausted its reconnects. Each tab dials with its own tab id so the api keys the SSE
 * stream per tab, and backoff is jittered so tabs across a shared outage don't redial together.
 */
import { sdk, type WidgetCommand, type WidgetEvent } from '../sdk';
import { logWarn } from '../utils/log';

type StreamStatus = 'disconnected' | 'connecting' | 'open' | 'registered' | 'error';

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const CREDENTIALS_REJECTED = 'Chat is unavailable — the widget credentials were rejected.';

export class StreamGaveUpError extends Error {}

type StreamCredentials = Pick<Parameters<typeof sdk.widgetStream>[0], 'marketrix_id' | 'marketrix_key'>;

interface StreamClientCallbacks {
  onMessage?: (event: WidgetEvent) => void;
  onError?: (error: Error) => void;
}

export class StreamClient {
  private abortController: AbortController | null = null;
  private chatId: string | null = null;
  private credentials: StreamCredentials | null = null;
  private status: StreamStatus = 'disconnected';
  private callbacks: Set<StreamClientCallbacks> = new Set();
  private tornDown = false;
  private credentialRejected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionId = 0;
  private readonly tabId = globalThis.crypto.randomUUID();
  private registrationWaiters = new Set<{ resolve: () => void; reject: (error: Error) => void }>();

  setCredentials(credentials: StreamCredentials): void {
    this.credentials = credentials;
  }

  addCallbacks(callbacks: StreamClientCallbacks): void {
    this.callbacks.add(callbacks);
  }

  removeCallbacks(callbacks: StreamClientCallbacks): void {
    this.callbacks.delete(callbacks);
  }

  private isConnected(): boolean {
    return this.status === 'registered';
  }

  private reconnectSuppressed(): boolean {
    return this.tornDown || this.credentialRejected;
  }

  canReconnect(): boolean {
    return this.chatId !== null && !this.reconnectSuppressed() && !this.isConnected();
  }

  reconnectNow(): void {
    if (!this.canReconnect() || this.chatId === null) return;
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.abortConnection();
    void this.connect(this.chatId);
  }

  async ready(chatId: string): Promise<void> {
    await this.connect(chatId);
    if (this.isConnected()) return;
    if (this.credentialRejected) throw new StreamGaveUpError(CREDENTIALS_REJECTED);
    await new Promise<void>((resolve, reject) => this.registrationWaiters.add({ resolve, reject }));
  }

  async connect(chatId: string): Promise<void> {
    if (this.credentialRejected) return;
    this.tornDown = false;

    if (
      this.chatId === chatId &&
      (this.status === 'connecting' || this.status === 'open' || this.status === 'registered')
    ) {
      return;
    }

    const credentials = this.credentials;
    if (!credentials) throw new Error('StreamClient.connect called before setCredentials');

    this.abortConnection();

    this.chatId = chatId;
    this.status = 'connecting';
    const myConnectionId = ++this.connectionId;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const iterator = await sdk.widgetStream({ chat_id: chatId, tab_id: this.tabId, ...credentials }, { signal });

      this.status = 'open';

      this.consumeEvents(iterator, myConnectionId);
    } catch (error) {
      if (!signal.aborted) {
        logWarn('[StreamClient] Connection failed, will retry:', error);
        this.status = 'error';
        this.notifyError(new Error('Stream connection failed'));
        this.scheduleReconnect();
      }
    }
  }

  private async consumeEvents(iterator: AsyncIterable<WidgetEvent>, connectionId: number): Promise<void> {
    let stale = false;
    try {
      for await (const event of iterator) {
        if (this.connectionId !== connectionId) {
          stale = true;
          break;
        }
        this.handleMessage(event);
      }
    } catch (error) {
      if (this.connectionId !== connectionId) {
        stale = true;
      } else if (!this.reconnectSuppressed()) {
        logWarn('[StreamClient] Stream error:', error);
        this.status = 'error';
      }
    } finally {
      if (!stale && this.connectionId === connectionId && !this.reconnectSuppressed()) {
        this.status = 'disconnected';
        this.scheduleReconnect();
      }
    }
  }

  disconnect(): void {
    this.tornDown = true;
    this.credentialRejected = false;
    this.clearReconnectTimer();
    this.abortConnection();
    this.chatId = null;
    this.settleWaiters(new Error('Stream disconnected before registration'));
  }

  send(command: WidgetCommand, chatId = this.chatId): Promise<void> {
    if (!chatId) {
      return Promise.reject(new Error('No active chat'));
    }
    return sdk.widgetMessagePost({ chat_id: chatId, tab_id: this.tabId, command }).then(() => {});
  }

  private notifyError(error: Error): void {
    this.callbacks.forEach(cb => cb.onError?.(error));
  }

  private settleWaiters(error?: Error): void {
    for (const waiter of this.registrationWaiters) {
      if (error) waiter.reject(error);
      else waiter.resolve();
    }
    this.registrationWaiters.clear();
  }

  private giveUp(message: string): void {
    const error = new StreamGaveUpError(message);
    this.notifyError(error);
    this.settleWaiters(error);
  }

  private handleMessage(event: WidgetEvent): void {
    if (this.reconnectSuppressed()) return;
    if (event.type === 'heartbeat') return;

    if (event.type === 'registered') {
      if (event.chat_id === this.chatId) {
        this.status = 'registered';
        this.reconnectAttempts = 0;
        this.settleWaiters();
      }
    }

    if (event.type === 'chat/error' && event.request_id === 'auth') {
      console.error('[StreamClient] Authentication failed — will not reconnect');
      this.credentialRejected = true;
      this.giveUp(CREDENTIALS_REJECTED);
    }

    this.callbacks.forEach(cb => cb.onMessage?.(event));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.giveUp('Could not reconnect to the assistant. Try again.');
      return;
    }
    this.clearReconnectTimer();
    this.reconnectAttempts++;
    const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * 2 ** (this.reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);
    const jittered = delay / 2 + Math.random() * (delay / 2);
    this.reconnectTimer = setTimeout(() => {
      if (!this.reconnectSuppressed() && this.chatId) {
        void this.connect(this.chatId);
      }
    }, jittered);
  }

  private abortConnection(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.status = 'disconnected';
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const streamClient = new StreamClient();

/**
 * Singleton SSE transport between the widget and the api, exported as `streamClient`, whose whole lifecycle is one
 * `StreamState` published through `subscribe`/`getState`; `streamNotice` turns a state into the visitor's banner.
 * `setCredentials` holds the stream's credentials, `onEvent` hands each event to a subscriber, `send` posts a command
 * via `widgetMessagePost`, `ready` connects and waits for registration, and `reconnectNow` backs Retry.
 * Backoff is jittered so tabs across a shared outage don't redial together, and a tab evicted by another page with
 * its tab id redials under a fresh one.
 */
import { getSdk, type WidgetClient, type WidgetCommand, type WidgetEvent } from '../sdk';
import { logWarn } from '../utils/log';
import { claimTabId, remintTabId } from './StorageService';

export type StreamState =
  | { phase: 'idle' }
  | { phase: 'connecting' | 'open'; chatId: string; gen: number; attempt: number }
  | { phase: 'registered'; chatId: string; gen: number }
  | { phase: 'backoff'; chatId: string; attempt: number }
  | { phase: 'gaveUp'; chatId: string; reason: 'exhausted' | 'credentials' };

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;
export const GAVE_UP_TEXT = {
  exhausted: 'Could not reconnect to the assistant. Try again.',
  credentials: 'Chat is unavailable — the widget credentials were rejected.',
};
const RECONNECTING_TEXT = 'Lost the connection to the assistant. Reconnecting…';

export function streamNotice(state: StreamState): { message: string; canRetry: boolean } | undefined {
  if (state.phase === 'gaveUp') return { message: GAVE_UP_TEXT[state.reason], canRetry: state.reason === 'exhausted' };
  if ('attempt' in state && state.attempt > 0) return { message: RECONNECTING_TEXT, canRetry: true };
  return undefined;
}

type StreamCredentials = Pick<Parameters<WidgetClient['widgetStream']>[0], 'marketrix_id' | 'marketrix_key'>;

interface StreamRoute {
  chatId: string | null;
  tabId: string;
}

class StreamClient {
  private state: StreamState = { phase: 'idle' };
  private gen = 0;
  private abortController: AbortController | null = null;
  private credentials: StreamCredentials | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private stateListeners = new Set<(state: StreamState) => void>();
  private eventHandlers = new Set<(event: WidgetEvent) => void>();

  setCredentials(credentials: StreamCredentials): void {
    this.credentials = credentials;
  }

  readonly getState = (): StreamState => this.state;

  readonly subscribe = (listener: (state: StreamState) => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  onEvent(handler: (event: WidgetEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  reconnectNow(): void {
    const state = this.state;
    if (state.phase === 'idle' || state.phase === 'registered') return;
    if (state.phase === 'gaveUp' && state.reason === 'credentials') return;
    void this.dial(state.chatId, 0);
  }

  ready(chatId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const settled = (state: StreamState): boolean => {
        if (state.phase === 'registered' && state.chatId === chatId) resolve();
        else if (state.phase === 'gaveUp') reject(new Error(GAVE_UP_TEXT[state.reason]));
        else if (state.phase === 'idle') reject(new Error('Stream disconnected before registration'));
        else return false;
        return true;
      };
      const unsubscribe = this.subscribe(state => {
        if (settled(state)) unsubscribe();
      });
      this.connect(chatId).catch((error: unknown) => {
        unsubscribe();
        reject(error);
      });
      if (settled(this.state)) unsubscribe();
    });
  }

  async connect(chatId: string): Promise<void> {
    const state = this.state;
    if (state.phase === 'gaveUp' && state.reason === 'credentials') return;
    if ('gen' in state && state.chatId === chatId) return;
    await this.dial(chatId, 0);
  }

  disconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.abortController?.abort();
    this.abortController = null;
    this.transition({ phase: 'idle' });
  }

  route(): StreamRoute {
    return { chatId: this.state.phase === 'idle' ? null : this.state.chatId, tabId: claimTabId() };
  }

  send(
    command: WidgetCommand,
    { chatId = this.route().chatId, tabId = claimTabId() }: Partial<StreamRoute> = {},
  ): Promise<void> {
    if (!chatId) return Promise.reject(new Error('No active chat'));
    return getSdk()
      .widgetMessagePost({ chat_id: chatId, tab_id: tabId, command })
      .then(() => {});
  }

  private transition(state: StreamState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }

  private live(gen: number): boolean {
    return 'gen' in this.state && this.state.gen === gen;
  }

  private async dial(chatId: string, attempt: number): Promise<void> {
    const credentials = this.credentials;
    if (!credentials) throw new Error('StreamClient.connect called before setCredentials');

    clearTimeout(this.reconnectTimer);
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    const gen = ++this.gen;
    this.transition({ phase: 'connecting', chatId, gen, attempt });

    let iterator: AsyncIterable<WidgetEvent>;
    try {
      iterator = await getSdk().widgetStream(
        { chat_id: chatId, tab_id: claimTabId(), ...credentials },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!this.live(gen)) return;
      logWarn('[StreamClient] Connection failed, will retry:', error);
      this.backoff(chatId, attempt);
      return;
    }
    if (!this.live(gen)) return;
    this.transition({ phase: 'open', chatId, gen, attempt });
    void this.consume(iterator, chatId, gen, attempt);
  }

  private async consume(iterator: AsyncIterable<WidgetEvent>, chatId: string, gen: number, attempt: number) {
    try {
      for await (const event of iterator) {
        if (!this.live(gen)) return;
        this.handleMessage(event);
      }
      if (this.live(gen) && this.state.phase === 'registered') remintTabId();
    } catch (error) {
      if (this.live(gen)) logWarn('[StreamClient] Stream error:', error);
    }
    if (this.live(gen)) this.backoff(chatId, this.state.phase === 'registered' ? 0 : attempt);
  }

  private handleMessage(event: WidgetEvent): void {
    if (event.type === 'heartbeat') return;
    const state = this.state;

    if (event.type === 'registered' && state.phase === 'open' && state.chatId === event.chat_id) {
      this.transition({ phase: 'registered', chatId: state.chatId, gen: state.gen });
    }

    if (event.type === 'chat/error' && event.request_id === 'auth' && state.phase !== 'idle') {
      console.error('[StreamClient] Authentication failed — will not reconnect');
      this.abortController?.abort();
      this.transition({ phase: 'gaveUp', chatId: state.chatId, reason: 'credentials' });
    }

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[StreamClient] A subscriber failed handling ${event.type}:`, error);
      }
    }
  }

  private backoff(chatId: string, failed: number): void {
    if (failed >= MAX_RECONNECT_ATTEMPTS) {
      this.transition({ phase: 'gaveUp', chatId, reason: 'exhausted' });
      return;
    }
    const attempt = failed + 1;
    const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * 2 ** failed, MAX_RECONNECT_DELAY_MS);
    this.transition({ phase: 'backoff', chatId, attempt });
    this.reconnectTimer = setTimeout(() => void this.dial(chatId, attempt), delay / 2 + Math.random() * (delay / 2));
  }
}

export const streamClient = new StreamClient();

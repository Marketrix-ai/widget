import { sdk, type WidgetCommand, type WidgetEvent } from '../sdk';

export type StreamStatus = 'disconnected' | 'connecting' | 'connected' | 'registered' | 'error';

export interface StreamClientCallbacks {
  onStatusChange?: (status: StreamStatus) => void;
  onMessage?: (event: WidgetEvent) => void;
  onError?: (error: Error) => void;
  onRegistered?: (applicationId: number | undefined) => void;
}

export class StreamClient {
  private static instance: StreamClient | null = null;
  private abortController: AbortController | null = null;
  private chatId: string | null = null;
  private status: StreamStatus = 'disconnected';
  private callbacks: Set<StreamClientCallbacks> = new Set();
  private isIntentionallyDisconnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private config?: { mtxId?: string; mtxKey?: string; mtxAgent?: number; mtxApp?: number };
  private connectionId = 0;

  private constructor() {}

  static getInstance(): StreamClient {
    if (!StreamClient.instance) {
      StreamClient.instance = new StreamClient();
    }
    return StreamClient.instance;
  }

  addCallbacks(callbacks: StreamClientCallbacks): void {
    this.callbacks.add(callbacks);
  }

  removeCallbacks(callbacks: StreamClientCallbacks): void {
    this.callbacks.delete(callbacks);
  }

  getStatus(): StreamStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'registered';
  }

  async connect(
    chatId: string,
    config?: { mtxId?: string; mtxKey?: string; mtxAgent?: number; mtxApp?: number },
  ): Promise<void> {
    if (this.isIntentionallyDisconnected) {
      this.isIntentionallyDisconnected = false;
    }

    if (this.isConnected() && this.chatId === chatId) {
      return;
    }

    // Abort any existing stream connection
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.chatId = chatId;
    if (config) {
      this.config = config;
    }
    this.setStatus('connecting');
    const myConnectionId = ++this.connectionId;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // Build the stream input with auth params
      const streamInput: Record<string, unknown> = { chat_id: chatId };
      if (this.config?.mtxId && this.config?.mtxKey) {
        streamInput.marketrix_id = this.config.mtxId;
        streamInput.marketrix_key = this.config.mtxKey;
      } else if (this.config?.mtxAgent && this.config?.mtxApp) {
        streamInput.agent_id = this.config.mtxAgent;
        streamInput.application_id = this.config.mtxApp;
      }

      // Call the oRPC streaming endpoint — returns an async iterator for eventIterator outputs
      type WidgetStreamInput = {
        chat_id: string;
        tab_id?: string;
        marketrix_id?: string;
        marketrix_key?: string;
        agent_id?: number;
        application_id?: number;
      };
      const iterator = await sdk.widgetStream(streamInput as WidgetStreamInput, { signal });

      this.setStatus('connected');
      // Reconnect counters reset only on `registered` (see handleMessage) — resetting
      // here, before registration, would defeat the max-attempts cap if registration
      // never lands and the stream flaps open→closed in a tight loop.

      // Consume events in the background; do not await here
      this.consumeEvents(iterator, myConnectionId);
    } catch (error) {
      if (!signal.aborted) {
        console.error('[StreamClient] Connection failed:', error);
        this.setStatus('error');
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
      } else if (!this.isIntentionallyDisconnected) {
        console.warn('[StreamClient] Stream error:', error);
        this.setStatus('error');
      }
    } finally {
      if (!stale && this.connectionId === connectionId && !this.isIntentionallyDisconnected) {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }
    }
  }

  disconnect(): void {
    this.isIntentionallyDisconnected = true;
    this.clearReconnectTimer();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setStatus('disconnected');
    this.chatId = null;
  }

  send(command: WidgetCommand): Promise<void> {
    if (!this.chatId) {
      return Promise.reject(new Error('No active chat'));
    }
    return sdk
      .widgetMessage({
        chat_id: this.chatId,
        command,
      })
      .then(() => {})
      .catch(err => {
        this.notifyError(new Error(`Failed to send message: ${String(err)}`));
        throw err;
      });
  }

  private setStatus(status: StreamStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.callbacks.forEach(cb => cb.onStatusChange?.(status));
    }
  }

  private notifyError(error: Error): void {
    this.callbacks.forEach(cb => cb.onError?.(error));
  }

  private handleMessage(event: WidgetEvent): void {
    if (this.isIntentionallyDisconnected) return;
    // Heartbeats are keepalive-only — ignore silently
    if (event.type === 'heartbeat') return;

    if (event.type === 'registered') {
      if (event.chat_id === this.chatId) {
        console.log('[StreamClient] Successfully registered with server');
        this.setStatus('registered');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.callbacks.forEach(cb => cb.onRegistered?.(event.application_id));
      }
    }

    // Auth errors are non-retriable — stop reconnecting with same bad credentials
    if (event.type === 'chat/error' && event.request_id === 'auth') {
      console.error('[StreamClient] Authentication failed — will not reconnect');
      this.isIntentionallyDisconnected = true;
    }

    this.callbacks.forEach(cb => cb.onMessage?.(event));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyError(new Error('Max reconnect attempts reached'));
      return;
    }
    this.clearReconnectTimer();
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    console.log(
      `[StreamClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );
    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionallyDisconnected && this.chatId) {
        this.connect(this.chatId, this.config).catch(console.error);
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

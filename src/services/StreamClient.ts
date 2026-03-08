import { sdk } from '../sdk';
import type { WidgetCommand, WidgetEvent } from '../sdk/schema';
import { sessionManager } from './SessionManager';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'registered' | 'error';

export interface WebSocketClientCallbacks {
  onStatusChange?: (status: WebSocketStatus) => void;
  onMessage?: (event: WidgetEvent) => void;
  onError?: (error: Error) => void;
}

export class StreamClient {
  private static instance: StreamClient | null = null;
  private abortController: AbortController | null = null;
  private chatId: string | null = null;
  private status: WebSocketStatus = 'disconnected';
  private callbacks: Set<WebSocketClientCallbacks> = new Set();
  private isIntentionallyDisconnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private config?: { mtxId?: string; mtxKey?: string; mtxAgent?: number; mtxApp?: number };

  private constructor() {}

  static getInstance(): StreamClient {
    if (!StreamClient.instance) {
      StreamClient.instance = new StreamClient();
    }
    return StreamClient.instance;
  }

  addCallbacks(callbacks: WebSocketClientCallbacks): void {
    this.callbacks.add(callbacks);
  }

  removeCallbacks(callbacks: WebSocketClientCallbacks): void {
    this.callbacks.delete(callbacks);
  }

  getStatus(): WebSocketStatus {
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

    const tabId = sessionManager.getTabId();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // Build the stream input with auth params
      const streamInput: Record<string, unknown> = { chat_id: chatId, tab_id: tabId ?? undefined };
      if (this.config?.mtxId && this.config?.mtxKey) {
        streamInput.marketrix_id = this.config.mtxId;
        streamInput.marketrix_key = this.config.mtxKey;
      } else if (this.config?.mtxAgent && this.config?.mtxApp) {
        streamInput.agent_id = this.config.mtxAgent;
        streamInput.connection_id = this.config.mtxApp;
      }

      // Call the oRPC streaming endpoint — returns an async iterator for eventIterator outputs
      const iterator = await sdk.widgetStream(streamInput as any, { signal });

      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Consume events in the background; do not await here
      this.consumeEvents(iterator, chatId);
    } catch (error) {
      if (!signal.aborted) {
        console.error('[StreamClient] Connection failed:', error);
        this.setStatus('error');
        this.notifyError(new Error('Stream connection failed'));
        this.scheduleReconnect();
      }
    }
  }

  private async consumeEvents(iterator: AsyncIterable<WidgetEvent>, chatId: string): Promise<void> {
    try {
      for await (const event of iterator) {
        // Stop processing if the chat has changed (a reconnect replaced us)
        if (this.chatId !== chatId) break;
        this.handleMessage(event);
      }
    } catch (error) {
      if (!this.isIntentionallyDisconnected) {
        console.warn('[StreamClient] Stream error:', error);
        this.setStatus('error');
      }
    } finally {
      if (!this.isIntentionallyDisconnected && this.chatId === chatId) {
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

  send(command: WidgetCommand): void {
    if (!this.chatId) {
      console.warn('[StreamClient] Cannot send: no active chat');
      return;
    }

    // Fire-and-forget POST via SDK
    sdk
      .widgetMessage({
        chat_id: this.chatId,
        command,
      })
      .catch(err => {
        console.error('[StreamClient] Send failed:', err);
        this.notifyError(new Error(`Failed to send message: ${String(err)}`));
      });
  }

  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.callbacks.forEach(cb => cb.onStatusChange?.(status));
    }
  }

  private notifyError(error: Error): void {
    this.callbacks.forEach(cb => cb.onError?.(error));
  }

  private handleMessage(event: WidgetEvent): void {
    if (event.type === 'registered') {
      if (event.chat_id === this.chatId) {
        console.log('[StreamClient] Successfully registered with server');
        this.setStatus('registered');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      }
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

import { getAgentWebSocketUrl } from '../constants/config';
import type { MarketrixConfig } from '../types';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'registered' | 'error';

export interface WebSocketMessage {
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  id?: string | number;
}

export interface WebSocketClientCallbacks {
  onStatusChange?: (status: WebSocketStatus) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
}

export class WebSocketClient {
  private static instance: WebSocketClient | null = null;
  private websocket: WebSocket | null = null;
  private url: string;
  private chatId: string | null = null;
  private status: WebSocketStatus = 'disconnected';
  private callbacks: Set<WebSocketClientCallbacks> = new Set();

  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyDisconnected = false;

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatIntervalMs = 20000;

  private constructor(config?: Partial<MarketrixConfig>) {
    this.url = getAgentWebSocketUrl(config);
  }

  static getInstance(config?: Partial<MarketrixConfig>): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient(config);
    } else if (config) {
      // If config is provided, ensure we update the URL if not connected or force update logic if needed
      // But typically we don't want to change the URL mid-flight unless disconnected.
      // We can check if the new config would result in a different URL.
      const newUrl = getAgentWebSocketUrl(config);
      if (newUrl !== WebSocketClient.instance.url) {
        WebSocketClient.instance.url = newUrl;
        // If disconnected, the next connect() will use the new URL.
        // If connected, we might want to reconnect?
        // For now, assume URL changes only happen before connection or require explicit reconnect.
      }
    }
    return WebSocketClient.instance;
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
    return this.status === 'registered' && this.websocket?.readyState === WebSocket.OPEN;
  }

  async connect(chatId: string): Promise<void> {
    if (this.isIntentionallyDisconnected) {
      // Reset intentional disconnect flag if explicitly called to connect
      this.isIntentionallyDisconnected = false;
    }

    if (this.isConnected() && this.chatId === chatId) {
      return;
    }

    // Handle existing connection
    if (
      this.websocket &&
      (this.chatId !== chatId || this.websocket.readyState !== WebSocket.CONNECTING)
    ) {
      this.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.chatId = chatId;
    this.isIntentionallyDisconnected = false;
    this.setStatus('connecting');

    try {
      this.websocket = new WebSocket(this.url);

      this.websocket.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.clearReconnectTimer();
        this.sendRegistration();
        this.startHeartbeat();
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          this.notifyError(new Error(`Failed to parse message: ${String(error)}`));
        }
      };

      this.websocket.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.setStatus('error');
        this.notifyError(new Error('WebSocket connection error'));
      };

      this.websocket.onclose = () => {
        this.setStatus('disconnected');
        this.stopHeartbeat();
        this.websocket = null;

        if (!this.isIntentionallyDisconnected && this.chatId) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      this.setStatus('error');
      this.notifyError(error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isIntentionallyDisconnected = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.setStatus('disconnected');
    this.chatId = null;
  }

  send(message: WebSocketMessage): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.websocket.send(JSON.stringify(message));
  }

  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.callbacks.forEach((cb) => cb.onStatusChange?.(status));
    }
  }

  private notifyError(error: Error): void {
    this.callbacks.forEach((cb) => cb.onError?.(error));
  }

  private handleMessage(message: WebSocketMessage): void {
    // Handle internal protocol messages
    if (message.method === 'widget/registered') {
      if (message.params?.chat_id === this.chatId) {
        this.setStatus('registered');
        this.reconnectAttempts = 0;
      }
    }

    // Forward everything to listeners
    this.callbacks.forEach((cb) => cb.onMessage?.(message));
  }

  private sendRegistration(): void {
    if (!this.chatId) return;
    this.send({
      jsonrpc: '2.0',
      method: 'widget/register',
      params: { chat_id: this.chatId },
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyError(new Error('Max reconnect attempts reached'));
      return;
    }

    this.clearReconnectTimer();
    this.reconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionallyDisconnected && this.chatId) {
        this.connect(this.chatId);
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.send({ jsonrpc: '2.0', method: 'ping', params: { timestamp: Date.now() } });
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

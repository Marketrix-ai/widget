import { getAgentWebSocketUrl } from '../constants/config';
import type { MarketrixConfig } from '../types';
import type { ToolResponse } from '../types/toolMessages';
import { sessionManager } from './SessionManager';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'registered' | 'error';

export interface WebSocketMessage {
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  stateVersion?: number;
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
  private readonly connectionTimeoutMs = 10000;
  private connectPromise: Promise<void> | null = null;
  private connectPromiseChatId: string | null = null;

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

  getUrl(): string {
    return this.url;
  }

  isConnected(): boolean {
    return this.status === 'registered' && this.websocket?.readyState === WebSocket.OPEN;
  }

  async connect(chatId: string): Promise<void> {
    if (this.isIntentionallyDisconnected) {
      this.isIntentionallyDisconnected = false;
    }

    if (this.isConnected() && this.chatId === chatId) {
      return;
    }

    if (this.connectPromise && this.connectPromiseChatId === chatId) {
      return this.connectPromise;
    }

    if (this.connectPromise) {
      await this.connectPromise.catch(() => {});
    }

    this.connectPromiseChatId = chatId;
    this.connectPromise = this.doConnect(chatId);
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
      this.connectPromiseChatId = null;
    }
  }

  private async doConnect(chatId: string): Promise<void> {
    if (this.websocket) {
      if (this.chatId !== chatId || this.websocket.readyState !== WebSocket.CONNECTING) {
        this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    this.chatId = chatId;
    this.isIntentionallyDisconnected = false;
    this.setStatus('connecting');
    if (!this.url) {
      console.warn('[WebSocket] Cannot connect: No AI host URL provided in configuration');
      this.setStatus('error');
      return;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.websocket = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('[WebSocket] Connection timeout');
          ws.close();
          this.setStatus('error');
          this.notifyError(new Error('WebSocket connection timeout'));
          reject(new Error('Connection timeout'));
        }
      }, this.connectionTimeoutMs);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        if (this.websocket !== ws) return;
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.clearReconnectTimer();
        this.sendRegistration();
        this.startHeartbeat();
        resolve();
      };

      ws.onmessage = event => {
        if (this.websocket !== ws) return;
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          this.notifyError(new Error(`Failed to parse message: ${String(error)}`));
        }
      };

      ws.onerror = error => {
        clearTimeout(connectionTimeout);
        if (this.websocket !== ws) return;
        console.error('[WebSocket] Error:', error);
        this.setStatus('error');
        this.notifyError(new Error('WebSocket connection error'));
        reject(new Error('WebSocket connection error'));
      };

      ws.onclose = event => {
        clearTimeout(connectionTimeout);
        if (this.websocket !== ws) return;

        const wasRegistered = this.status === 'registered';
        this.setStatus('disconnected');
        this.stopHeartbeat();
        this.websocket = null;

        if (event.code !== 1000) {
          console.warn(
            `[WebSocket] Connection closed with code ${event.code}: ${event.reason || 'No reason provided'}`,
          );
        }

        if (!this.isIntentionallyDisconnected && this.chatId) {
          if (wasRegistered) {
            setTimeout(() => {
              if (!this.isIntentionallyDisconnected && this.chatId) {
                this.scheduleReconnect();
              }
            }, 500);
          } else {
            this.scheduleReconnect();
          }
        }
        resolve();
      };
    });
  }

  disconnect(): void {
    this.isIntentionallyDisconnected = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.connectPromise = null;
    this.connectPromiseChatId = null;

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.setStatus('disconnected');
    this.chatId = null;
  }

  send(message: WebSocketMessage | ToolResponse<unknown>): void {
    if (!this.websocket) {
      console.warn('[WebSocket] Cannot send message: WebSocket is null');
      return;
    }
    if (this.websocket.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] Cannot send message: WebSocket state is ${this.websocket.readyState} (not OPEN)`);
      return;
    }
    try {
      this.websocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
      this.notifyError(new Error(`Failed to send message: ${String(error)}`));
    }
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

  private handleMessage(message: WebSocketMessage): void {
    // Handle internal protocol messages
    if (message.method === 'widget/registered') {
      if (message.params?.chat_id === this.chatId) {
        console.log('[WebSocket] Successfully registered with server');
        this.setStatus('registered');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset delay on successful registration
      }
    } else if (message.method === 'pong') {
      // Acknowledge pong to confirm connection is alive
      // This is handled by the server updating last_ping_pong
    }

    // Forward everything to listeners
    this.callbacks.forEach(cb => cb.onMessage?.(message));
  }

  private sendRegistration(): void {
    if (!this.chatId) return;
    if (this.status !== 'connected' && this.status !== 'registered') {
      // Wait for connection
      return;
    }

    // Include tab_id for cross-domain session linking
    const tabId = sessionManager.getTabId();

    this.send({
      jsonrpc: '2.0',
      method: 'widget/register',
      params: {
        chat_id: this.chatId,
        tab_id: tabId,
        url: window.location.href,
      },
    });
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
      `[WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionallyDisconnected && this.chatId) {
        console.log(`[WebSocket] Attempting reconnect (attempt ${this.reconnectAttempts})...`);
        this.connect(this.chatId).catch(error => {
          console.error('[WebSocket] Reconnect attempt failed:', error);
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        });
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

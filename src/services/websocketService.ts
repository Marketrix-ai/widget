import { getAgentWebSocketUrl } from '../constants/config';
import type { MarketrixConfig } from '../types';
import { executeTool } from './toolExecutor';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'registered' | 'error';

// Global singleton instance to ensure only one websocket connection exists
let globalWebSocketService: WebSocketService | null = null;

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

export interface WebSocketServiceCallbacks {
  onStatusChange?: (status: WebSocketStatus) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
}

export class WebSocketService {
  private websocket: WebSocket | null = null;
  private url: string;
  private chatId: string | null = null;
  private status: WebSocketStatus = 'disconnected';
  private callbacks: WebSocketServiceCallbacks = {};
  private allCallbacks: Set<WebSocketServiceCallbacks> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyDisconnected = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatIntervalMs = 60000; // 60 seconds - just monitor connection health
  private lastPongTime: number = 0;

  constructor(config?: Partial<MarketrixConfig>, callbacks?: WebSocketServiceCallbacks) {
    // Warn if constructor is called directly instead of using getInstance
    if (globalWebSocketService && globalWebSocketService !== this) {
      console.warn(
        '[WebSocket] Constructor called directly but singleton already exists. Use getInstance() instead.'
      );
    }
    this.url = getAgentWebSocketUrl(config);
    if (callbacks) {
      this.callbacks = callbacks;
      this.allCallbacks.add(callbacks);
    }
  }

  /**
   * Get or create the global singleton websocket service instance
   * This ensures only ONE websocket connection exists globally
   */
  static getInstance(
    config?: Partial<MarketrixConfig>,
    callbacks?: WebSocketServiceCallbacks
  ): WebSocketService {
    if (!globalWebSocketService) {
      console.log('[WebSocket] Creating new singleton WebSocketService instance');
      globalWebSocketService = new WebSocketService(config, callbacks);
    } else {
      console.log('[WebSocket] Reusing existing singleton WebSocketService instance');
      // Update URL if config changed (shouldn't happen, but just in case)
      if (config) {
        const newUrl = getAgentWebSocketUrl(config);
        if (newUrl !== globalWebSocketService.url) {
          console.warn(
            '[WebSocket] URL changed, but singleton already exists. Keeping existing connection.'
          );
        }
      }
      // Add callbacks to existing instance
      if (callbacks) {
        globalWebSocketService.addCallbacks(callbacks);
      }
    }
    return globalWebSocketService;
  }

  /**
   * Clear the global singleton instance (for testing or cleanup)
   */
  static clearInstance(): void {
    if (globalWebSocketService) {
      globalWebSocketService.disconnect();
      globalWebSocketService = null;
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Check if websocket is connected and registered
   */
  isConnected(): boolean {
    return this.status === 'registered' && this.websocket?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to the websocket server
   */
  async connect(chatId: string): Promise<void> {
    if (this.isIntentionallyDisconnected) {
      console.log('[WebSocket] Connection intentionally disconnected, skipping connect');
      return;
    }

    // If already connected and registered with the same chat_id, do nothing
    if (this.isConnected() && this.chatId === chatId) {
      console.log('[WebSocket] Already connected and registered with same chat_id');
      return;
    }

    // If already connecting with the same chat_id, wait for it to complete
    if (this.websocket?.readyState === WebSocket.CONNECTING && this.chatId === chatId) {
      console.log('[WebSocket] Connection already in progress with same chat_id');
      return;
    }

    // If already connected but with different chat_id, disconnect first
    if (this.websocket && this.chatId !== chatId) {
      console.log('[WebSocket] Chat ID changed, disconnecting existing connection');
      this.disconnect();
      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // If connection is open but not registered yet, wait a bit
    if (this.websocket?.readyState === WebSocket.OPEN && this.status !== 'registered') {
      console.log('[WebSocket] Connection open but not registered yet, waiting...');
      // Give it a moment to complete registration
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.isConnected() && this.chatId === chatId) {
        console.log('[WebSocket] Connection registered while waiting');
        return;
      }
    }

    this.chatId = chatId;
    this.isIntentionallyDisconnected = false;

    // Double-check we're not already connecting/connected
    if (this.websocket?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Connection already in progress, skipping');
      return;
    }

    if (this.websocket?.readyState === WebSocket.OPEN && this.chatId === chatId) {
      console.log('[WebSocket] Connection already open with same chat_id');
      return;
    }

    // Ensure we're using the singleton instance
    if (globalWebSocketService && globalWebSocketService !== this) {
      console.warn(
        '[WebSocket] This instance is not the singleton. Redirecting to singleton instance.'
      );
      // Redirect to singleton
      if (globalWebSocketService.isConnected() && globalWebSocketService.getChatId() === chatId) {
        console.log('[WebSocket] Using existing connection from singleton instance');
        // Update this instance to point to singleton's connection
        this.websocket = globalWebSocketService.websocket;
        this.chatId = globalWebSocketService.chatId;
        this.status = globalWebSocketService.status;
        return;
      }
      // If singleton exists but not connected, let it handle the connection
      if (!globalWebSocketService.isConnected()) {
        console.log('[WebSocket] Singleton exists but not connected, letting it connect');
        await globalWebSocketService.connect(chatId);
        return;
      }
    }

    this.setStatus('connecting');
    console.log(`[WebSocket] Connecting to ${this.url} with chat_id: ${chatId}`);

    try {
      // Ensure we close any existing websocket before creating a new one
      if (this.websocket && this.websocket.readyState !== WebSocket.CLOSED) {
        console.log('[WebSocket] Closing existing websocket before creating new one');
        this.websocket.close();
        this.websocket = null;
        // Wait a bit for cleanup
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.websocket = new WebSocket(this.url);

      this.websocket.onopen = () => {
        console.log('[WebSocket] Connection opened');
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        // Clear any pending reconnect timers
        this.clearReconnectTimer();
        this.sendRegistration();
        this.startHeartbeat();
      };

      this.websocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError(
              new Error(
                `Failed to parse websocket message: ${error instanceof Error ? error.message : String(error)}`
              )
            );
          }
        }
      };

      this.websocket.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        this.setStatus('error');
        if (this.callbacks.onError) {
          this.callbacks.onError(new Error('WebSocket connection error'));
        }
      };

      this.websocket.onclose = (event) => {
        console.log('[WebSocket] Connection closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        this.setStatus('disconnected');
        this.stopHeartbeat();
        const wasIntentionallyDisconnected = this.isIntentionallyDisconnected;
        this.websocket = null;

        // Attempt to reconnect if not intentionally disconnected
        // Only reconnect if we have a chat_id and the close wasn't intentional
        if (!wasIntentionallyDisconnected && this.chatId) {
          console.log('[WebSocket] Connection closed unexpectedly, scheduling reconnect...');
          this.scheduleReconnect();
        } else if (wasIntentionallyDisconnected) {
          console.log('[WebSocket] Connection closed intentionally, not reconnecting');
        } else {
          console.log('[WebSocket] No chat_id available, not reconnecting');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create websocket:', error);
      this.setStatus('error');
      if (this.callbacks.onError) {
        this.callbacks.onError(
          new Error(
            `Failed to create websocket: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the websocket server
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting...');
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

  /**
   * Send a message through the websocket
   */
  send(message: WebSocketMessage): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send message, websocket not open');
      throw new Error('WebSocket is not connected');
    }

    try {
      const jsonMessage = JSON.stringify(message);
      this.websocket.send(jsonMessage);
      console.log('[WebSocket] Sent message:', message.method || 'unknown');
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Update callbacks (replaces existing callbacks)
   */
  setCallbacks(callbacks: WebSocketServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
    // Also update in allCallbacks if it exists
    if (this.allCallbacks.size > 0) {
      // Merge with existing callbacks from allCallbacks
      const mergedCallbacks: WebSocketServiceCallbacks = {};
      for (const cb of this.allCallbacks) {
        if (cb.onStatusChange) mergedCallbacks.onStatusChange = cb.onStatusChange;
        if (cb.onMessage) mergedCallbacks.onMessage = cb.onMessage;
        if (cb.onError) mergedCallbacks.onError = cb.onError;
      }
      // Override with new callbacks
      Object.assign(mergedCallbacks, callbacks);
      this.callbacks = mergedCallbacks;
    }
  }

  /**
   * Add callbacks (adds to existing callbacks, all are called)
   */
  addCallbacks(callbacks: WebSocketServiceCallbacks): void {
    this.allCallbacks.add(callbacks);
    // Merge callbacks
    const merged: WebSocketServiceCallbacks = {};
    for (const cb of this.allCallbacks) {
      if (cb.onStatusChange && !merged.onStatusChange) {
        merged.onStatusChange = cb.onStatusChange;
      }
      if (cb.onMessage && !merged.onMessage) {
        merged.onMessage = cb.onMessage;
      }
      if (cb.onError && !merged.onError) {
        merged.onError = cb.onError;
      }
    }
    this.callbacks = merged;
  }

  /**
   * Remove callbacks
   */
  removeCallbacks(callbacks: WebSocketServiceCallbacks): void {
    this.allCallbacks.delete(callbacks);
    // Rebuild merged callbacks
    const merged: WebSocketServiceCallbacks = {};
    for (const cb of this.allCallbacks) {
      if (cb.onStatusChange && !merged.onStatusChange) {
        merged.onStatusChange = cb.onStatusChange;
      }
      if (cb.onMessage && !merged.onMessage) {
        merged.onMessage = cb.onMessage;
      }
      if (cb.onError && !merged.onError) {
        merged.onError = cb.onError;
      }
    }
    this.callbacks = merged;
  }

  /**
   * Get current chat_id
   */
  getChatId(): string | null {
    return this.chatId;
  }

  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      console.log(`[WebSocket] Status changed to: ${status}`);
      if (this.callbacks.onStatusChange) {
        this.callbacks.onStatusChange(status);
      }
    }
  }

  private sendRegistration(): void {
    if (!this.chatId) {
      console.error('[WebSocket] Cannot register, chat_id is missing');
      return;
    }

    const registrationMessage: WebSocketMessage = {
      jsonrpc: '2.0',
      method: 'widget/register',
      params: {
        chat_id: this.chatId,
      },
    };

    try {
      this.send(registrationMessage);
      console.log('[WebSocket] Sent registration message with chat_id:', this.chatId);
    } catch (error) {
      console.error('[WebSocket] Failed to send registration:', error);
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('[WebSocket] Received message:', message.method || 'unknown');

    // Update last activity time on any message received
    this.lastPongTime = Date.now();

    // Handle registration confirmation
    if (message.method === 'widget/registered') {
      const chatId = message.params?.chat_id as string | undefined;
      if (chatId && chatId === this.chatId) {
        console.log('[WebSocket] Registration confirmed for chat_id:', chatId);
        this.setStatus('registered');
        // Reset reconnect attempts on successful registration
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        // Clear any pending reconnect timers
        this.clearReconnectTimer();
      } else {
        console.warn('[WebSocket] Registration confirmation with mismatched chat_id');
      }
    }

    // Handle tools/call messages - execute tool and send response back
    if (message.method === 'tools/call' && message.id !== undefined) {
      this.handleToolCall(message);
      return; // Don't forward tool call messages to callbacks
    }

    // Any message received indicates the connection is alive
    // TCP/WebSocket transport handles keepalive automatically

    // Forward message to callback
    if (this.callbacks.onMessage) {
      this.callbacks.onMessage(message);
    }
  }

  /**
   * Handle a tool call message from the agent.
   * Executes the tool and sends the result back via websocket.
   */
  private async handleToolCall(message: WebSocketMessage): Promise<void> {
    const requestId = message.id;
    const params = message.params as
      | {
          name?: string;
          arguments?: Record<string, unknown>;
        }
      | undefined;

    if (!params?.name) {
      console.error('[WebSocket] Invalid tools/call message: missing name');
      this.sendErrorResponse(requestId, -32602, 'Invalid params: name is required');
      return;
    }

    const toolName = params.name;
    const arguments_ = params.arguments || {};

    console.log(`[WebSocket] Executing tool call: ${toolName}`, arguments_);

    try {
      // Execute the tool
      const result = await executeTool(toolName, arguments_);

      // Send success response
      // Note: Agent expects method: "tools/call" in response to identify it as a tool call response
      if (result.success) {
        const response: WebSocketMessage = {
          jsonrpc: '2.0',
          method: 'tools/call', // Agent checks for this to identify tool call responses
          id: requestId,
          result: {
            content: [
              {
                type: 'text',
                text: result.result,
              },
            ],
          },
        };
        this.send(response);
        console.log(`[WebSocket] Tool ${toolName} executed successfully`);
      } else {
        // Send error response
        this.sendErrorResponse(requestId, -32603, result.error || 'Tool execution failed');
        console.error(`[WebSocket] Tool ${toolName} execution failed:`, result.error);
      }
    } catch (error) {
      // Send error response for unexpected errors
      // Only send if websocket is still open
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        try {
          this.sendErrorResponse(requestId, -32603, `Internal error: ${errorMessage}`);
        } catch (sendError) {
          console.error(`[WebSocket] Failed to send error response:`, sendError);
        }
      }
      console.error(`[WebSocket] Error executing tool ${toolName}:`, error);
    }
  }

  /**
   * Send an error response in MCP JSON-RPC format.
   * Note: Agent expects method: "tools/call" in response to identify it as a tool call response
   */
  private sendErrorResponse(
    requestId: string | number | undefined,
    code: number,
    message: string
  ): void {
    const response: WebSocketMessage = {
      jsonrpc: '2.0',
      method: 'tools/call', // Agent checks for this to identify tool call responses
      id: requestId,
      error: {
        code,
        message,
      },
    };
    this.send(response);
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyDisconnected || !this.chatId) {
      return;
    }

    // Don't schedule reconnect if already connected or connecting
    if (this.isConnected() || this.websocket?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Already connected or connecting, skipping reconnect');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.setStatus('error');
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error('Max reconnect attempts reached'));
      }
      return;
    }

    // Clear any existing reconnect timer before scheduling a new one
    this.clearReconnectTimer();

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `[WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      // Clear the timer reference
      this.reconnectTimer = null;

      // Double-check conditions before reconnecting
      if (
        !this.isIntentionallyDisconnected &&
        this.chatId &&
        !this.isConnected() &&
        this.websocket?.readyState !== WebSocket.CONNECTING
      ) {
        console.log(`[WebSocket] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this.connect(this.chatId).catch((error) => {
          console.error('[WebSocket] Reconnect failed:', error);
        });
      } else {
        console.log('[WebSocket] Reconnect conditions not met, skipping');
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
    this.lastPongTime = Date.now();

    // Monitor connection health without sending custom ping messages
    // Rely on TCP/WebSocket transport-level keepalive mechanisms
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        try {
          // Check if connection is still responsive by monitoring state
          // TCP/WebSocket protocol handles keepalive at transport level
          const timeSinceLastActivity = Date.now() - this.lastPongTime;

          // Just verify the connection state is still OPEN
          // The WebSocket protocol itself maintains the connection
          if (this.websocket.readyState !== WebSocket.OPEN) {
            console.warn('[WebSocket] WebSocket state is not OPEN, stopping heartbeat');
            this.stopHeartbeat();
            return;
          }

          // Connection appears healthy - TCP keepalive is handling connection maintenance
          // Only log if there's been no activity for a very long time (5+ minutes)
          if (timeSinceLastActivity > 300000) {
            console.warn(
              `[WebSocket] No application-level activity for ${Math.round(timeSinceLastActivity / 1000)}s, but connection state is OPEN`
            );
          }
        } catch (error) {
          console.error('[WebSocket] Heartbeat check failed:', error);
          // If check fails, connection is likely dead, let onclose handle it
          this.stopHeartbeat();
        }
      } else if (
        this.websocket?.readyState === WebSocket.CLOSING ||
        this.websocket?.readyState === WebSocket.CLOSED
      ) {
        // Connection is closing or closed, stop heartbeat
        this.stopHeartbeat();
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

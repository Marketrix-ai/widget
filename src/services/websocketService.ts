import { getAgentWebSocketUrl } from '../constants/config';
import type { MarketrixConfig } from '../types';
import { clearPendingToolCall, storePendingToolCall } from '../utils/chatStorage';
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
  onToolCallProgress?: (toolName: string, explanation: string, mode: string) => void;
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
  private readonly heartbeatIntervalMs = 20000; // 20 seconds - send ping to prevent 20s timeout

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
      console.error('[WebSocket] Cannot send message, websocket not open', {
        hasWebsocket: !!this.websocket,
        readyState: this.websocket?.readyState,
        messageMethod: message.method,
        messageId: message.id,
      });
      throw new Error('WebSocket is not connected');
    }

    try {
      const jsonMessage = JSON.stringify(message);
      this.websocket.send(jsonMessage);
      console.log('[WebSocket] Sent message:', {
        method: message.method || 'unknown',
        id: message.id,
        hasResult: !!message.result,
        hasError: !!message.error,
        messageLength: jsonMessage.length,
      });
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error, {
        method: message.method,
        id: message.id,
      });
      throw error;
    }
  }

  /**
   * Update callbacks (replaces existing callbacks completely)
   */
  setCallbacks(callbacks: WebSocketServiceCallbacks): void {
    // Clear all existing callbacks and set new ones
    this.allCallbacks.clear();
    this.allCallbacks.add(callbacks);
    this.callbacks = { ...callbacks };
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
      if (cb.onToolCallProgress && !merged.onToolCallProgress) {
        merged.onToolCallProgress = cb.onToolCallProgress;
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
      if (cb.onToolCallProgress && !merged.onToolCallProgress) {
        merged.onToolCallProgress = cb.onToolCallProgress;
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

  /**
   * Retry a pending tool call (used after page refresh)
   */
  async retryToolCall(
    requestId: string | number,
    toolName: string,
    arguments_: Record<string, unknown>,
    mode: string,
    explanation: string
  ): Promise<void> {
    console.log(
      `[WebSocket] Retrying tool call after refresh: ${toolName} (mode: ${mode})`,
      arguments_
    );

    // Execute without storing pending (already stored before refresh)
    await this.executeToolCallInternal(
      requestId,
      toolName,
      arguments_,
      mode,
      explanation,
      false // Don't store pending tool call (already stored)
    );
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
    // Detailed message structure logging for verification
    console.log('[WebSocket] [STRUCTURE] Received message structure:', {
      method: message.method,
      hasId: message.id !== undefined,
      id: message.id,
      idType: typeof message.id,
      hasParams: message.params !== undefined,
      paramsType: typeof message.params,
      paramsIsNull: message.params === null,
      paramsIsObject: message.params !== null && typeof message.params === 'object',
      paramsKeys:
        message.params && typeof message.params === 'object'
          ? Object.keys(message.params as Record<string, unknown>)
          : [],
      paramsValue: message.params,
      hasResult: message.result !== undefined,
      resultType: typeof message.result,
      hasError: message.error !== undefined,
      errorValue: message.error,
      jsonrpc: message.jsonrpc,
      fullMessage: JSON.stringify(message, null, 2),
    });

    // For tools/call messages, log detailed params structure
    if (message.method === 'tools/call') {
      const params = message.params as
        | {
            name?: string;
            arguments?: Record<string, unknown>;
            mode?: string;
            explanation?: string;
          }
        | undefined;
      console.log('[WebSocket] [STRUCTURE] tools/call message details:', {
        hasParams: !!message.params,
        paramsExists: message.params !== undefined && message.params !== null,
        paramsName: params?.name,
        paramsMode: params?.mode,
        paramsExplanation: params?.explanation,
        paramsArguments: params?.arguments,
        paramsStructure: params,
        hasParamsWithName: !!params?.name,
      });
    }

    console.log('[WebSocket] Received message:', message.method || 'unknown');
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

    // Handle pong response to ping
    if (message.method === 'pong') {
      console.log('[WebSocket] Received pong');
    }

    // Handle tools/call messages - execute tool and send response back
    if (message.method === 'tools/call' && message.id !== undefined) {
      const params = message.params as
        | {
            name?: string;
            arguments?: Record<string, unknown>;
            mode?: string;
            explanation?: string;
          }
        | undefined;

      // Forward the tool call message to onMessage callback FIRST so widget can update progress
      if (this.callbacks.onMessage) {
        console.log('[WebSocket] [FLOW] Forwarding tool call message to onMessage callback', {
          messageId: message.id,
          toolName: params?.name,
          explanation: params?.explanation,
          hasParams: !!message.params,
          hasResult: !!message.result,
          hasError: !!message.error,
          paramsKeys:
            message.params && typeof message.params === 'object'
              ? Object.keys(message.params as Record<string, unknown>)
              : [],
          fullParams: message.params,
        });
        try {
          this.callbacks.onMessage(message);
          console.log('[WebSocket] [FLOW] Successfully called onMessage callback');
        } catch (error) {
          console.error('[WebSocket] [FLOW] Error in onMessage callback:', error);
        }
      } else {
        console.error(
          '[WebSocket] [FLOW] CRITICAL: No onMessage callback registered, cannot forward tool call for progress update'
        );
      }
      // Then execute the tool
      this.handleToolCall(message);
      return; // Don't forward again after handleToolCall
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
          mode?: string;
          explanation?: string;
        }
      | undefined;

    if (!params?.name) {
      console.error('[WebSocket] Invalid tools/call message: missing name');
      this.sendErrorResponse(requestId, -32602, 'Invalid params: name is required');
      return;
    }

    const toolName = params.name;
    const arguments_ = params.arguments || {};
    const mode = params.mode || 'do'; // Default to 'do' mode if not specified
    const explanation = params.explanation || ''; // Get explanation from tool call params

    console.log(`[WebSocket] Executing tool call: ${toolName} (mode: ${mode})`, arguments_);
    console.log(`[WebSocket] Explanation: "${explanation}"`);
    console.log(`[WebSocket] Callback available: ${!!this.callbacks.onToolCallProgress}`);

    // Note: Initial progress is already shown in handleMessage when the tool call is received
    // This avoids duplicate progress entries

    // Execute with storing pending tool call (for retry after refresh)
    await this.executeToolCallInternal(
      requestId,
      toolName,
      arguments_,
      mode,
      explanation,
      true // Store pending tool call for retry after refresh
    );
  }

  /**
   * Internal method to execute a tool call.
   * Handles execution, response creation, sending, and error handling.
   */
  private async executeToolCallInternal(
    requestId: string | number | undefined,
    toolName: string,
    arguments_: Record<string, unknown>,
    mode: string,
    explanation: string,
    shouldStorePending: boolean
  ): Promise<void> {
    // Store pending tool call if requested (for normal tool calls, not retries)
    if (shouldStorePending && this.chatId && requestId !== undefined) {
      storePendingToolCall(this.chatId, requestId, toolName, arguments_, mode, explanation);
    }

    try {
      // Execute the tool with mode and explanation
      console.log(`[WebSocket] Starting tool execution: ${toolName} (mode: ${mode})`, {
        requestId,
        arguments_,
        explanation,
      });
      const result = await executeTool(toolName, arguments_, mode, explanation);
      console.log(`[WebSocket] Tool execution result:`, result);

      // Handle success or failure
      if (result.success) {
        const response = this.createSuccessResponse(requestId, result.result);
        console.log(
          `[WebSocket] Tool ${toolName} executed successfully, preparing to send response:`,
          {
            requestId,
            toolName,
            resultLength: result.result.length,
            resultPreview: result.result.substring(0, 100),
            responseMethod: response.method,
            responseId: response.id,
            websocketState: this.websocket?.readyState,
            isConnected: this.isConnected(),
          }
        );
        try {
          // Forward result BEFORE clearing pending tool call so result handler can match by requestId
          this.sendAndForwardResponse(response);
          console.log(`[WebSocket] Successfully sent and forwarded response for tool ${toolName}`);
        } catch (sendError) {
          console.error(`[WebSocket] Failed to send response for tool ${toolName}:`, sendError, {
            requestId,
            toolName,
            websocketState: this.websocket?.readyState,
            isConnected: this.isConnected(),
          });
          // Still clear pending tool call even if send failed
        }
        // Clear pending tool call AFTER forwarding so result handler can still access it
        clearPendingToolCall();
      } else {
        this.handleToolCallError(
          requestId,
          toolName,
          -32603,
          result.error || 'Tool execution failed'
        );
        // Clear pending tool call after forwarding error
        clearPendingToolCall();
        console.error(`[WebSocket] Tool ${toolName} execution failed:`, result.error);
      }
    } catch (error) {
      // Clear pending tool call on error (after forwarding if possible)
      clearPendingToolCall();

      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleToolCallError(requestId, toolName, -32603, `Internal error: ${errorMessage}`);
      console.error(`[WebSocket] Error executing tool ${toolName}:`, error);
    }
  }

  /**
   * Create a success response message for tool execution.
   */
  private createSuccessResponse(
    requestId: string | number | undefined,
    resultText: string
  ): WebSocketMessage {
    return {
      jsonrpc: '2.0',
      method: 'tools/call', // Agent checks for this to identify tool call responses
      id: requestId,
      result: {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      },
    };
  }

  /**
   * Send a response and forward it to the onMessage callback.
   */
  private sendAndForwardResponse(response: WebSocketMessage): void {
    try {
      // CRITICAL: Send the response to the server FIRST
      // This must happen even if forwarding fails
      console.log('[WebSocket] Sending tool call response to server:', {
        method: response.method,
        id: response.id,
        hasResult: !!response.result,
        hasError: !!response.error,
      });
      this.send(response);
      console.log('[WebSocket] Successfully sent tool call response to server');
    } catch (sendError) {
      // Log error but continue to forward to callback for UI update
      console.error('[WebSocket] Failed to send tool call response to server:', sendError, {
        method: response.method,
        id: response.id,
      });
      // Don't throw - still forward to callback so UI can update
    }

    // Forward the result message to onMessage callback so it can update progress
    // Ensure the message has the correct format for routing
    const resultMessage: WebSocketMessage = {
      jsonrpc: response.jsonrpc || '2.0',
      method: 'tools/call', // Ensure method is set for routing
      id: response.id,
      result: response.result,
      // Explicitly set params and error to undefined (not null or empty object) to ensure routing works
      params: undefined,
      error: undefined,
    };
    if (this.callbacks.onMessage) {
      const resultContent = resultMessage.result as
        | { content?: Array<{ type?: string; text?: string }> }
        | undefined;
      const resultText = resultContent?.content?.[0]?.text || 'No result text';

      console.log('[WebSocket] Forwarding result message to onMessage callback:', {
        method: resultMessage.method,
        messageId: resultMessage.id,
        hasId: !!resultMessage.id,
        hasResult: !!resultMessage.result,
        resultText: resultText.substring(0, 100),
        hasParams: resultMessage.params !== undefined,
        paramsIsUndefined: resultMessage.params === undefined,
        hasError: resultMessage.error !== undefined,
        errorIsUndefined: resultMessage.error === undefined,
      });
      this.callbacks.onMessage(resultMessage);
    } else {
      console.warn(
        '[WebSocket] No onMessage callback registered, cannot forward result for progress update!'
      );
    }
  }

  /**
   * Handle tool call errors by sending error response and forwarding to callbacks.
   */
  private handleToolCallError(
    requestId: string | number | undefined,
    toolName: string,
    code: number,
    message: string
  ): void {
    // Only send if websocket is still open
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      try {
        const errorResponse = this.sendErrorResponse(requestId, code, message);
        // Forward the error response to onMessage callback so it can update progress
        if (this.callbacks.onMessage && errorResponse) {
          const errorMessage: WebSocketMessage = {
            jsonrpc: errorResponse.jsonrpc || '2.0',
            method: 'tools/call', // Ensure method is set for routing
            id: errorResponse.id,
            error: errorResponse.error,
            // Explicitly set params and result to undefined (not null or empty object) to ensure routing works
            params: undefined,
            result: undefined,
          };
          const errorText = errorResponse.error?.message || 'Unknown error';
          console.log('[WebSocket] Forwarding error message to onMessage callback:', {
            method: errorMessage.method,
            messageId: errorMessage.id,
            hasId: !!errorMessage.id,
            hasError: !!errorMessage.error,
            errorText: errorText.substring(0, 100),
            hasParams: errorMessage.params !== undefined,
            paramsIsUndefined: errorMessage.params === undefined,
            hasResult: errorMessage.result !== undefined,
            resultIsUndefined: errorMessage.result === undefined,
          });
          this.callbacks.onMessage(errorMessage);
        }
      } catch (sendError) {
        console.error(`[WebSocket] Failed to send error response for tool ${toolName}:`, sendError);
      }
    }
  }

  /**
   * Send an error response in MCP JSON-RPC format.
   * Note: Agent expects method: "tools/call" in response to identify it as a tool call response
   * Returns the response message so it can be forwarded to onMessage callback
   */
  private sendErrorResponse(
    requestId: string | number | undefined,
    code: number,
    message: string
  ): WebSocketMessage | null {
    const response: WebSocketMessage = {
      jsonrpc: '2.0',
      method: 'tools/call', // Agent checks for this to identify tool call responses
      id: requestId,
      error: {
        code,
        message,
      },
    };
    try {
      this.send(response);
      return response;
    } catch (error) {
      console.error('[WebSocket] Failed to send error response:', error);
      return null;
    }
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

    // Send periodic ping messages to prevent proxy/load balancer timeout (20s)
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        try {
          // Send JSON-RPC ping message to keep connection alive
          const pingMessage: WebSocketMessage = {
            jsonrpc: '2.0',
            method: 'ping',
            params: { timestamp: Date.now() },
          };
          this.send(pingMessage);
          console.log('[WebSocket] Sent ping');
        } catch (error) {
          console.error('[WebSocket] Failed to send ping:', error);
          // If ping fails, connection is likely dead, let onclose handle it
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

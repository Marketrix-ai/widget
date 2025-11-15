/**
 * MCP Client Service
 *
 * Handles WebSocket connection to the agent server for MCP protocol communication.
 * Connects to ws://localhost:8765/widget with chat_id for registration.
 */

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export type MCPToolHandler = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<MCPToolResult>;

export class MCPClient {
  private ws: WebSocket | null = null;
  private chatId: string | null = null;
  private agentServerUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private toolHandlers: Map<string, MCPToolHandler> = new Map();
  private onChatIdReceived?: (chatId: string) => void;
  private onConnectionChange?: (connected: boolean) => void;

  constructor(agentServerUrl: string = 'ws://localhost:8765') {
    this.agentServerUrl = agentServerUrl
      .replace(/^https?:\/\//, 'ws://')
      .replace(/^wss?:\/\//, 'ws://');
    if (!this.agentServerUrl.endsWith('/widget')) {
      this.agentServerUrl = `${this.agentServerUrl}/widget`;
    }
  }

  /**
   * Connect to the agent server and register the widget with chat_id
   */
  async connect(chatId: string): Promise<string> {
    if (!chatId) {
      throw new Error('chat_id is required to connect');
    }

    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return this.chatId || '';
    }

    this.chatId = chatId;
    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.agentServerUrl);

        ws.onopen = () => {
          console.log('[MCP Client] Connected to agent server');
          this.ws = ws;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.onConnectionChange?.(true);

          // Send chat_id registration message
          const registration = {
            jsonrpc: '2.0',
            method: 'widget/register',
            params: { chat_id: chatId },
          };
          ws.send(JSON.stringify(registration));
        };

        ws.onmessage = (event) => {
          try {
            const message: MCPMessage = JSON.parse(event.data as string) as MCPMessage;
            this.handleMessage(message);

            // Resolve promise when registration is confirmed
            if (
              message.method === 'widget/registered' &&
              message.params &&
              typeof message.params === 'object' &&
              'chat_id' in message.params &&
              typeof message.params.chat_id === 'string'
            ) {
              this.chatId = message.params.chat_id;
              this.onChatIdReceived?.(this.chatId);
              resolve(this.chatId);
            }
          } catch (error) {
            console.error('[MCP Client] Failed to parse message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[MCP Client] WebSocket error:', error);
          this.isConnecting = false;
          this.onConnectionChange?.(false);
          reject(error);
        };

        ws.onclose = (event) => {
          console.log('[MCP Client] WebSocket closed', event.code, event.reason);
          this.ws = null;
          this.isConnecting = false;
          this.onConnectionChange?.(false);

          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(
              `[MCP Client] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
            );
            setTimeout(() => {
              if (this.chatId) {
                this.connect(this.chatId).catch(console.error);
              }
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle incoming MCP messages
   */
  private handleMessage(message: MCPMessage): void {
    if (message.method === 'widget/registered') {
      // Already handled in onmessage
      return;
    }

    if (message.method === 'tools/call' && message.params) {
      const params = message.params as unknown as MCPToolCall;
      const { name, arguments: args } = params;
      const requestId = message.id;

      if (!requestId) {
        console.error('[MCP Client] Received tool call without request ID');
        return;
      }

      // Find handler for this tool
      const handler = this.toolHandlers.get(name);
      if (!handler) {
        console.error(`[MCP Client] No handler registered for tool: ${name}`);
        this.sendToolResponse(requestId, null, {
          code: -32601,
          message: `Tool handler not found: ${name}`,
        });
        return;
      }

      // Execute tool handler
      handler(name, args)
        .then((result) => {
          this.sendToolResponse(requestId, result, null);
        })
        .catch((error: unknown) => {
          console.error(`[MCP Client] Tool execution error for ${name}:`, error);
          this.sendToolResponse(requestId, null, {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          });
        });
    }
  }

  /**
   * Send tool response back to server
   */
  private sendToolResponse(
    requestId: string | number,
    result: MCPToolResult | null,
    error: { code: number; message: string } | null
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[MCP Client] Cannot send response: WebSocket not connected');
      return;
    }

    const response: MCPMessage = {
      jsonrpc: '2.0',
      id: requestId,
      result: result ? { content: result.content } : undefined,
      error: error || undefined,
    };

    this.ws.send(JSON.stringify(response));
  }

  /**
   * Register a tool handler
   */
  registerToolHandler(toolName: string, handler: MCPToolHandler): void {
    this.toolHandlers.set(toolName, handler);
  }

  /**
   * Unregister a tool handler
   */
  unregisterToolHandler(toolName: string): void {
    this.toolHandlers.delete(toolName);
  }

  /**
   * Get the current chat_id
   */
  getChatId(): string | null {
    return this.chatId;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.chatId = null;
    this.onConnectionChange?.(false);
  }

  /**
   * Set callback for when chat_id registration is confirmed
   */
  onChatId(callback: (chatId: string) => void): void {
    this.onChatIdReceived = callback;
  }

  /**
   * Set callback for connection state changes
   */
  onConnectionStateChange(callback: (connected: boolean) => void): void {
    this.onConnectionChange = callback;
  }
}

/**
 * Typed structures for MCP tool call messages between agent and widget.
 *
 * These types ensure type safety and consistency between Python (agent) and TypeScript (widget) sides.
 */

import type { WebSocketMessage } from '../services/WebSocketClient';

/**
 * Parameters for a tool call request.
 * Matches the Python ToolCallRequestParams structure.
 */
export interface ToolCallRequestParams extends Record<string, unknown> {
  /** Name of the tool to call */
  name: string;
  /** Tool-specific arguments (dict of string keys to any values) */
  arguments: Record<string, unknown>;
  /** Execution mode - 'show' or 'do' (subset of InstructionType) */
  mode: 'show' | 'do';
  /** Optional explanation for the tool call */
  explanation?: string;
}

/**
 * Complete JSON-RPC 2.0 tool call request message.
 * This structure is sent from agent to widget via WebSocket.
 * Matches the Python ToolCallRequest structure.
 */
export interface ToolCallRequestMessage extends WebSocketMessage {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/call';
  params: ToolCallRequestParams;
}

/**
 * TextContent structure in JSON-RPC response.
 * Matches the MCP TextContent type structure and Python TextContentDict.
 */
export interface TextContentDict {
  type: 'text';
  text: string;
}

/**
 * Content structure in tool call response.
 * Matches the Python ToolCallResponseContent structure.
 */
export interface ToolCallResponseContent {
  content: TextContentDict[];
}

/**
 * Complete JSON-RPC 2.0 tool call response message.
 * This structure is sent from widget to agent via WebSocket.
 * Matches the Python ToolCallResponse structure.
 */
export interface ToolCallResponseMessage extends WebSocketMessage {
  jsonrpc: '2.0';
  id: string | number;
  result: ToolCallResponseContent;
}

/**
 * JSON-RPC 2.0 error response for tool calls.
 * Matches the Python ToolCallErrorResponse structure.
 */
export interface ToolCallErrorResponseMessage extends WebSocketMessage {
  jsonrpc: '2.0';
  id: string | number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Type guard to check if a WebSocketMessage is a ToolCallRequestMessage.
 */
export function isToolCallRequestMessage(
  message: WebSocketMessage
): message is ToolCallRequestMessage {
  return (
    message.method === 'tools/call' &&
    message.jsonrpc === '2.0' &&
    typeof message.id !== 'undefined' &&
    typeof message.params === 'object' &&
    message.params !== null &&
    typeof (message.params as ToolCallRequestParams).name === 'string'
  );
}

/**
 * Type guard to check if a WebSocketMessage is a ToolCallResponseMessage.
 */
export function isToolCallResponseMessage(
  message: WebSocketMessage
): message is ToolCallResponseMessage {
  return (
    message.jsonrpc === '2.0' &&
    typeof message.id !== 'undefined' &&
    typeof message.result === 'object' &&
    message.result !== null &&
    Array.isArray((message.result as ToolCallResponseContent).content)
  );
}

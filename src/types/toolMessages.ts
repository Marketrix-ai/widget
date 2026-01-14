/**
 * Simple typed messages for tool calls between agent and widget.
 * No JSON-RPC. No MCP. Just typed messages.
 */

// =================================================================================================
// Tool Request (Agent -> Widget)
// =================================================================================================

export interface ToolRequest {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  mode: 'show' | 'do';
  stateVersion: number;
  explanation?: string;
}

// =================================================================================================
// Tool Response (Widget -> Agent)
// =================================================================================================

export interface ToolResponse<T = { text: string }> {
  id: string;
  success: boolean;
  data: T;
  error: string | null;
  stateVersion: number;
}

// =================================================================================================
// Type Guards
// =================================================================================================

export function isToolRequest(message: unknown): message is ToolRequest {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return (
    typeof msg.id === 'string' &&
    typeof msg.tool === 'string' &&
    typeof msg.args === 'object' &&
    msg.args !== null &&
    (msg.mode === 'show' || msg.mode === 'do') &&
    typeof msg.stateVersion === 'number'
  );
}

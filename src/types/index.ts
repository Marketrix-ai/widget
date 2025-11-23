import type { InstructionType, WidgetSettingsData } from '../sdk';

// Re-export SDK types for proper type usage
export type {
  AgentData,
  ConnectionData,
  InstructionType,
  IntegrationData,
  TenantData,
  UserData,
  WidgetChip,
  WidgetSettingsData,
} from '../sdk';

/**
 * MarketrixConfig - Flat superset type extending WidgetSettingsData
 *
 * This type extends WidgetSettingsData (with all fields optional) with additional
 * widget-specific fields, allowing API settings to be spread directly:
 * { ...config, ...apiSettings }
 *
 * All fields are at the top level for easy merging and access.
 */
export type MarketrixConfig = Partial<WidgetSettingsData> & {
  // Core SDK fields (from IntegrationEntitySchema)
  // Either marketrixId/marketrixKey OR agentId/connectionId must be provided
  marketrixId?: string; // maps to marketrix_id from SDK
  marketrixKey?: string; // maps to marketrix_key from SDK

  // Alternative: Direct agent and connection IDs (when marketrixId/marketrixKey not available)
  agentId?: number; // Direct agent ID from agent table
  connectionId?: number; // Direct connection ID from connection table

  // Optional API configuration
  apiBaseUrl?: string;

  // Optional Agent Server URL for websocket connection
  agentServerUrl?: string;

  // Widget position config fields (offset/z_index) - local-only styling, not from API
  widget_position_offset?: {
    x?: number;
    y?: number;
  };
  widget_position_z_index?: number;
};

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  mode?: InstructionType;
  videoStream?: MediaStream;
  isScreenAccessRequest?: boolean;
  screenShareStatus?: 'allowed' | 'denied';
  isSystemMessage?: boolean;
  isPlaceholder?: boolean; // Indicates this is a placeholder message with progress bar
  placeholderState?: 'thinking' | 'waiting-for-user'; // State of placeholder: thinking or waiting for user action
  parts?: MessagePart[];
}

export interface MessagePart {
  type: 'text' | 'progress';
  content: string;
  status?: 'running' | 'completed' | 'failed' | 'canceled';
  toolName?: string;
  hideIcon?: boolean;
  textStyle?: 'default' | 'muted';
}

export interface TaskProgress {
  tool_name: string;
  tool_params: Record<string, unknown>;
  step: number;
  explanation: string;
  mode: string;
  timestamp: number;
}

export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
  agentAvailable: boolean;
  error?: string;
  activeTaskId: string | null;
  isTaskRunning: boolean;
  taskProgress: TaskProgress[];
}

export interface SendMessageRequest {
  message?: string;
  mode?: InstructionType;
  marketrixId?: string;
  marketrixKey?: string;
  connection_id?: number;
  question?: string;
}

export interface SendMessageResponse {
  messageId: string;
  response: string;
  mode: InstructionType;
  timestamp: Date;
  task_id?: string;
}

export type WidgetPosition = WidgetSettingsData['widget_position'];

// Re-export SDK types for convenience
export type { TourData } from '../sdk';

// Re-export browser tools types
export type {
  BrowserAction,
  BrowserToolMetadata,
  ClickElementAction,
  CloseTabAction,
  DoneAction,
  ExtractAction,
  GetDropdownOptionsAction,
  InputTextAction,
  NavigateAction,
  NoParamsAction,
  ScrollAction,
  SearchAction,
  SelectDropdownOptionAction,
  SendKeysAction,
  StructuredOutputAction,
  SwitchTabAction,
  UploadFileAction,
} from './browserTools';
export { BROWSER_TOOL_CATEGORIES, BROWSER_TOOLS } from './browserTools';

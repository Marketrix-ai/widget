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
 * MarketrixConfig - Single source of truth for all widget configuration
 *
 * This type extends WidgetSettingsData (with all fields optional) with additional
 * widget-specific fields, allowing API settings to be spread directly:
 * { ...config, ...apiSettings }
 *
 * All fields are at the top level for easy merging and access.
 *
 * Component-level defaults (not in config):
 * - Input placeholder: 'Ask anything'
 * - Live agent header: 'Live Agent'
 * - Live agent body: 'A live agent will be with you shortly.'
 * - Position offset default: { x: 20, y: 20 }
 * - Z-index default: 40
 */
export type MarketrixConfig = Partial<WidgetSettingsData> & {
  // Core SDK fields (from IntegrationEntitySchema)
  // Either mtxId/mtxKey OR mtxApp/mtxAgent must be provided
  mtxId?: string; // maps to marketrix_id from SDK (production mode)
  mtxKey?: string; // maps to marketrix_key from SDK (production mode)

  // Alternative: Direct agent and connection IDs (dev mode)
  mtxApp?: number; // Connection/app ID (maps to connection_id)
  mtxAgent?: number; // Agent ID (maps to agent_id)

  // Optional user ID for logging widget questions
  userId?: number; // User ID to associate with widget questions

  // Optional API configuration
  mtxApiHost?: string; // API server hostname

  // Optional AI/Agent Server URL for websocket connection
  mtxAiHost?: string; // AI/agent server hostname

  // Widget position config fields (offset/z_index) - local-only styling, not from API
  widget_position_offset?: {
    x?: number;
    y?: number;
  };
  widget_position_z_index?: number;

  // Preview mode flag - indicates widget is in preview mode (settings provided directly)
  isPreviewMode?: boolean;

  // Top-level behavioral controls for SDK consumers
  /** Controls visual rendering of the widget. When false, widget initializes fully but UI is hidden. Default: true */
  show_widget?: boolean;
  /** Controls screen sharing prompts and button. When false, screen access requests are auto-denied and Share Screen button is hidden. Default: true */
  use_screenshare?: boolean;
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
  taskStatus?: 'ongoing' | 'done' | 'failed' | 'stopped'; // Task status indicator for task messages
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

export type WidgetView = 'home' | 'chat' | 'help' | 'news';

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
  activeView: WidgetView;
}

export interface SendMessageRequest {
  message?: string;
  mode?: InstructionType;
  mtxId?: string;
  mtxKey?: string;
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

/**
 * Configuration for addWidget function
 * Supports preview, production, and dev modes
 */
export type AddWidgetConfig = (
  | {
      // Preview mode: provide settings directly
      settings: WidgetSettingsData;
      mtxId?: never;
      mtxKey?: never;
      mtxApp?: never;
      mtxAgent?: never;
    }
  | {
      // Production mode: provide marketrix credentials
      settings?: never;
      mtxId: string;
      mtxKey: string;
      mtxApp?: never;
      mtxAgent?: never;
    }
  | {
      // Dev mode: provide agent and connection IDs
      settings?: never;
      mtxId?: never;
      mtxKey?: never;
      mtxApp: number;
      mtxAgent: number;
    }
) & {
  // Optional container to mount widget within
  container?: HTMLElement;
  // Optional additional config
  mtxApiHost?: string;
  mtxAiHost?: string;
  userId?: number;
  widget_position_offset?: {
    x?: number;
    y?: number;
  };
  widget_position_z_index?: number;
  /** Controls visual rendering of the widget. When false, widget initializes fully but UI is hidden. Default: true */
  show_widget?: boolean;
  /** Controls screen sharing prompts and button. When false, screen access requests are auto-denied and Share Screen button is hidden. Default: true */
  use_screenshare?: boolean;
};

/**
 * Props for MarketrixWidget React component
 */
export interface MarketrixWidgetProps {
  settings: WidgetSettingsData;
  container?: HTMLElement;
  // Optional config overrides for preview mode
  mtxId?: string;
  mtxKey?: string;
  mtxApiHost?: string;
  mtxAiHost?: string;
}

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

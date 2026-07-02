import type { InstructionType, WidgetSettingsData } from '../sdk';

export type {
  ApplicationData,
  InstructionType,
  UserData,
  WidgetChip,
  WidgetData,
  WidgetSettingsData,
  WorkspaceData,
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
  // Either mtxId/mtxKey OR mtxApp must be provided
  mtxId?: string; // maps to marketrix_id from SDK (production mode)
  mtxKey?: string; // maps to marketrix_key from SDK (production mode)

  // Alternative: Direct application ID (dev mode)
  mtxApp?: number; // Application ID

  // Optional user ID for logging widget questions
  userId?: number; // User ID to associate with widget questions

  // Optional API configuration
  mtxApiHost?: string; // API server hostname

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
  simulationStatus?: 'ongoing' | 'done' | 'failed' | 'stopped'; // Simulation status indicator for agent messages
}

export interface MessagePart {
  type: 'text' | 'progress';
  content: string;
  status?: 'in_progress' | 'completed' | 'failed' | 'stopped';
  browserToolName?: string;
  hideIcon?: boolean;
  textStyle?: 'default' | 'muted';
  /** An in-flight streamed reply part — chat/delta fragments accumulate into it and the final
   *  chat/response replaces it. */
  streaming?: boolean;
}

export type WidgetView = 'home' | 'chat';

export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
  agentAvailable: boolean;
  error?: string;
  activeSimulationId: string | null;
  isSimulationRunning: boolean;
  activeView: WidgetView;
}

export interface MessageDispatchRequest {
  message?: string;
  mode?: InstructionType;
  mtxId?: string;
  mtxKey?: string;
  application_id?: number;
  question?: string;
  requestId?: string;
}

export interface MessageDispatchResponse {
  messageId: string;
  response: string;
  mode: InstructionType;
  timestamp: Date;
  task_id?: string;
}

export type WidgetPosition = WidgetSettingsData['widget_position'];

export type AddWidgetConfig = (
  | {
      // Preview mode: provide settings directly
      settings: WidgetSettingsData;
      mtxId?: never;
      mtxKey?: never;
      mtxApp?: never;
    }
  | {
      // Production mode: provide marketrix credentials
      settings?: never;
      mtxId: string;
      mtxKey: string;
      mtxApp?: never;
    }
  | {
      // Dev mode: provide the application ID
      settings?: never;
      mtxId?: never;
      mtxKey?: never;
      mtxApp: number;
    }
) & {
  // Optional container to mount widget within
  container?: HTMLElement;
  // Optional additional config
  mtxApiHost?: string;
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

export interface MarketrixWidgetProps {
  settings: WidgetSettingsData;
  container?: HTMLElement;
  // Optional config overrides for preview mode
  mtxId?: string;
  mtxKey?: string;
  mtxApiHost?: string;
}

export { BROWSER_TOOLS } from './browserTools';

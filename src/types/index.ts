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

// All widget config at top level so API settings spread in directly ({ ...config, ...apiSettings }).
// Provide mtxId+mtxKey (production) OR mtxApp (dev).
export type MarketrixConfig = Partial<WidgetSettingsData> & {
  mtxId?: string; // marketrix_id (production mode)
  mtxKey?: string; // marketrix_key (production mode)
  mtxApp?: number; // application ID (dev mode)
  userId?: number;
  mtxApiHost?: string;

  // local-only styling, not from API
  widget_position_offset?: {
    x?: number;
    y?: number;
  };
  widget_position_z_index?: number;

  isPreviewMode?: boolean;

  /** When false, widget initializes fully but UI is hidden. Default: true */
  show_widget?: boolean;
  /** When false, screen access requests are auto-denied and Share Screen button is hidden. Default: true */
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
  isPlaceholder?: boolean;
  placeholderState?: 'thinking' | 'waiting-for-user';
  parts?: MessagePart[];
  taskStatus?: 'ongoing' | 'done' | 'failed' | 'stopped';
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
  activeTaskId: string | null;
  isTaskRunning: boolean;
  activeView: WidgetView;
}

export interface MessageDispatchRequest {
  message?: string;
  mode?: InstructionType;
  requestId?: string;
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
  container?: HTMLElement;
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
  mtxId?: string;
  mtxKey?: string;
  mtxApiHost?: string;
}

export { BROWSER_TOOLS } from './browserTools';

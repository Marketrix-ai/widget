import type { InstructionType, WidgetSettingsData } from '../sdk';

export type { InstructionType, WidgetSettingsData } from '../sdk';

// Flat so API settings spread in directly. mtxId+mtxKey is the credential; mtxApp is set internally post-validation, never an input (an application id is guessable and authenticates nothing).
export type MarketrixConfig = Partial<WidgetSettingsData> & {
  mtxId?: string;
  mtxKey?: string;
  mtxApp?: number;
  userId?: number;
  mtxApiHost?: string;

  // Local-only styling, not from API.
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
  /** chat/delta fragments accumulate into this part; the final chat/response replaces it. */
  streaming?: boolean;
}

export type WidgetView = 'home' | 'chat';

export interface WidgetState {
  isOpen: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
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
      settings: WidgetSettingsData;
      mtxId?: never;
      mtxKey?: never;
    }
  | {
      settings?: never;
      mtxId: string;
      mtxKey: string;
    }
) & {
  container?: HTMLElement;
  mtxApiHost?: string;
  userId?: number;
  widget_position_z_index?: number;
  /** When false, widget initializes fully but UI is hidden. Default: true */
  show_widget?: boolean;
  /** When false, screen access requests are auto-denied and Share Screen button is hidden. Default: true */
  use_screenshare?: boolean;
};

export interface MarketrixWidgetProps {
  settings: WidgetSettingsData;
  container?: HTMLElement;
  mtxId?: string;
  mtxKey?: string;
  mtxApiHost?: string;
}

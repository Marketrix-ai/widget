import type { InstructionType, WidgetSettingsData } from '../sdk';
import type { WidgetRenderedSettings } from '../utils/validation';

export type { InstructionType, WidgetSettingsData } from '../sdk';

export interface ClientOwnedConfig {
  mtxApiHost?: string;
  userId?: number;
  widget_position_z_index?: number;
  /** When false, widget initializes fully but UI is hidden. Default: true */
  show_widget?: boolean;
  /** When false, screen access requests are auto-denied and Share Screen button is hidden. Default: true */
  use_screenshare?: boolean;
}

// Flat so API settings spread in directly. mtxId+mtxKey is the credential; mtxApp is set internally post-validation, never an input (an application id is guessable and authenticates nothing).
export type MarketrixConfig = Partial<WidgetRenderedSettings> &
  ClientOwnedConfig & {
    mtxId?: string;
    mtxKey?: string;
    mtxApp?: number;
    isPreviewMode?: boolean;
  };

/** A MarketrixConfig that has been through parseWidgetSettings — every rendered setting present. */
export type ValidWidgetConfig = MarketrixConfig & Required<Pick<MarketrixConfig, keyof WidgetRenderedSettings>>;

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  mode?: InstructionType;
  videoStream?: MediaStream;
  isScreenAccessRequest?: boolean;
  screenShareStatus?: 'allowed' | 'denied';
  /** The message queued behind an open screen-access request, sent once it resolves. */
  pendingContent?: string;
  isSystemMessage?: boolean;
  isPlaceholder?: boolean;
  placeholderState?: 'thinking' | 'waiting-for-user';
  parts: MessagePart[];
  taskStatus?: 'done' | 'failed' | 'stopped';
}

export interface MessagePart {
  type: 'text' | 'progress';
  content: string;
  status?: 'in_progress' | 'completed' | 'failed';
  browserToolName?: string;
  /** chat/delta fragments accumulate into this part; the final chat/response replaces it. */
  streaming?: boolean;
}

/** A message's text is the text it shows: its text parts joined. `content` is this value, kept by the
 *  writers, so a reader never has to know which of the two fields is authoritative. */
export const messageText = (parts: MessagePart[]): string =>
  parts
    .filter(part => part.type === 'text')
    .map(part => part.content)
    .join('\n');

export type WidgetView = 'home' | 'chat';

export interface WidgetState {
  isOpen: boolean;
  isAwaitingReply: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
  error?: string;
  isTaskRunning: boolean;
  activeView: WidgetView;
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
) &
  ClientOwnedConfig & { container?: HTMLElement };

export interface MarketrixWidgetPreviewProps {
  settings: WidgetSettingsData;
  container?: HTMLElement;
}

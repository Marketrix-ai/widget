/**
 * Widget-wide shared types: the config shapes a host supplies, the chat message/part model, and the UI
 * store shape. `messageText` joins a message's text parts into the string a render site displays.
 *
 * `MarketrixConfig` is deliberately flat so api settings spread straight into it; `mtxApp` is stamped
 * internally after validation rather than taken as input, since a bare application id is guessable and
 * authenticates nothing. `ValidWidgetConfig` is a `MarketrixConfig` that has passed `parseWidgetSettings`.
 * `taskStatus`/`MessagePart.status` are presentational labels only, not the `task/status` wire vocabulary.
 */
import type { InstructionType, WidgetSettingsData } from './sdk';
import type { WidgetRenderedSettings } from './utils/validation';

export type { InstructionType, WidgetSettingsData } from './sdk';

export interface ClientOwnedConfig {
  mtxApiHost?: string;
  userId?: number;
  widget_position_z_index?: number;
  show_widget?: boolean;
  use_screenshare?: boolean;
  styleNonce?: string;
}

export type MarketrixConfig = Partial<WidgetRenderedSettings> &
  ClientOwnedConfig & {
    mtxId?: string;
    mtxKey?: string;
    mtxApp?: number;
    isPreviewMode?: boolean;
  };

export type ValidWidgetConfig = MarketrixConfig &
  Required<Pick<MarketrixConfig, keyof WidgetRenderedSettings | 'isPreviewMode'>>;

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  mode?: InstructionType | undefined;
  videoStream?: MediaStream;
  isScreenAccessRequest?: boolean;
  screenShareStatus?: 'allowed' | 'denied';
  pendingContent?: string | undefined;
  isSystemMessage?: boolean;
  isPlaceholder?: boolean | undefined;
  placeholderState?: 'thinking' | 'waiting-for-user' | undefined;
  parts: MessagePart[];
  taskStatus?: 'done' | 'failed' | 'stopped';
}

export interface MessagePart {
  type: 'text' | 'progress';
  content: string;
  status?: 'in_progress' | 'completed' | 'failed';
  browserToolName?: string;
  streaming?: boolean;
}

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
  error?: string | undefined;
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

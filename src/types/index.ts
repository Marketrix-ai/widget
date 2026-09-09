/**
 * Widget-wide shared types: the config shapes a host supplies, the chat message/part model, the UI
 * store shape, and `messageText` — the one place a message's displayed text is derived.
 *
 * `ClientOwnedConfig` holds host-supplied knobs the api never sends (`show_widget: false` still
 * initializes the widget fully and only hides its UI; `use_screenshare: false` auto-denies
 * screen-access requests and hides the Share Screen button; both default true). `MarketrixConfig` is
 * deliberately FLAT so api settings spread straight in — `mtxId`+`mtxKey` is the credential, while
 * `mtxApp` is stamped internally after validation and never an input, since an application id is
 * guessable and authenticates nothing. `ValidWidgetConfig` is a `MarketrixConfig` run through
 * `parseWidgetSettings`, so every rendered setting is present. `ChatMessage`+`MessagePart` are the chat
 * model; `WidgetState` is the flattened read model `useWidget()` folds from `UIStateContext`+
 * `ChatContext`; `WidgetPosition` re-aliases `widget_position` as the drag-snap/resize corner
 * vocabulary; `AddWidgetConfig`'s union makes `settings` and `mtxId`/`mtxKey` mutually exclusive.
 * `ChatMessage.pendingContent` queues a message behind an open screen-access request, sent once it
 * resolves. A `streaming` `MessagePart` accumulates `chat/delta` fragments until the final
 * `chat/response` replaces it. `taskStatus`/`MessagePart.status` are presentational only, not the wire
 * vocabulary (`task/status.status`). `messageText` joins text parts and IS the text; `content` is kept
 * equal to it by every writer.
 */
import type { InstructionType, WidgetSettingsData } from '../sdk';
import type { WidgetRenderedSettings } from '../utils/validation';

export type { InstructionType, WidgetSettingsData } from '../sdk';

export interface ClientOwnedConfig {
  mtxApiHost?: string;
  userId?: number;
  widget_position_z_index?: number;
  show_widget?: boolean;
  use_screenshare?: boolean;
}

export type MarketrixConfig = Partial<WidgetRenderedSettings> &
  ClientOwnedConfig & {
    mtxId?: string;
    mtxKey?: string;
    mtxApp?: number;
    isPreviewMode?: boolean;
  };

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

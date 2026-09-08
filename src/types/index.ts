/**
 * Widget-wide shared types: the config shapes a host supplies, the chat message/part model, the UI store
 * shape, and `messageText` — the one place a message's displayed text is derived.
 *
 * Contents: `ClientOwnedConfig`, the host-supplied knobs the api never sends (`show_widget: false` still
 * initializes the widget fully and only hides its UI; `use_screenshare: false` auto-denies screen-access
 * requests and hides the Share Screen button; both default true) · `MarketrixConfig`, deliberately FLAT so
 * api settings spread straight in — `mtxId`+`mtxKey` is the credential, while `mtxApp` is stamped internally
 * after validation and is never an input, because an application id is guessable and authenticates nothing ·
 * `ValidWidgetConfig`, a `MarketrixConfig` that has been through `parseWidgetSettings`, so every rendered
 * setting is present · `ChatMessage` + `MessagePart`, the chat model · `messageText` · `WidgetView`, the shell's
 * active tab · `WidgetState`, nothing stored but the flattened read model `useWidget()` folds out of
 * `UIStateContext` + `ChatContext` · `WidgetPosition`, the api's `widget_position` re-aliased as the corner
 * vocabulary drag-snap and resize share · `AddWidgetConfig`, the public `mountWidget` argument, whose union makes
 * `settings` and the `mtxId`/`mtxKey` pair mutually exclusive · `MarketrixWidgetPreviewProps`, the props of the
 * no-network dashboard preview · re-exported `InstructionType` and `WidgetSettingsData` from the sdk.
 *
 * `ChatMessage.pendingContent` is the message queued behind an open screen-access request, sent once that
 * request resolves. A `MessagePart` marked `streaming` accumulates `chat/delta` fragments; the final
 * `chat/response` replaces it. `ChatMessage.taskStatus` and `MessagePart.status` are presentational only —
 * the wire vocabulary is `task/status.status`, and neither of these is it.
 *
 * `messageText` joins a message's text parts, and that IS the message's text; `content` is kept equal to it
 * by every writer, so a reader never has to know which of the two fields is authoritative.
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

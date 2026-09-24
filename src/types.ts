/**
 * Widget-wide shared types: the config a host supplies, the chat message/part model, and the UI store
 * shape. It is the one import path for the sdk types the widget publishes.
 * `MarketrixConfig` never carries a dashboard setting, since the api's settings always win. An agent message's
 * `status` (absent on a plain settled reply) and a progress part's `status` are UI labels, not the
 * `task/status` wire vocabulary.
 */
import type { InstructionType, WidgetSettingsData } from './sdk';
import type { StoredMessage } from './services/StorageService';
import type { WidgetRenderedSettings } from './services/WidgetService';

export type { InstructionType, WidgetSettingsData } from './sdk';

export interface ClientOwnedConfig {
  widget_position_z_index?: number;
  show_widget?: boolean;
  use_screenshare?: boolean;
  styleNonce?: string;
}

export type MarketrixConfig = ClientOwnedConfig & { mtxId: string; mtxKey: string; mtxApiHost: string };

export type ValidWidgetConfig = WidgetRenderedSettings &
  ClientOwnedConfig & { mtxId?: string; mtxKey?: string; isPreviewMode: boolean };

type ScreenshareMessage = Omit<Extract<StoredMessage, { kind: 'system' }>, 'kind'> & {
  kind: 'screenshare';
  videoStream: MediaStream;
};

export type ChatMessage = StoredMessage | ScreenshareMessage;

export type AgentMessage = Extract<ChatMessage, { kind: 'agent' }>;

export type MessagePart = ChatMessage['parts'][number];

export type ProgressPart = Extract<MessagePart, { type: 'progress' }>;

export type AgentStatus = NonNullable<AgentMessage['status']>;

export const WIDGET_VIEWS = ['home', 'chat'] as const;

export type WidgetView = (typeof WIDGET_VIEWS)[number];

export interface WidgetState {
  isOpen: boolean;
  isAwaitingReply: boolean;
  isComposerLocked: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
  error?: string | undefined;
  canRetry: boolean;
  isTaskRunning: boolean;
  activeView: WidgetView;
}

export type WidgetPosition = WidgetSettingsData['widget_position'];

export type AddWidgetConfig = (
  | {
      settings: WidgetSettingsData;
      mtxId?: never;
      mtxKey?: never;
      mtxApiHost?: never;
    }
  | ({ settings?: never } & Pick<MarketrixConfig, 'mtxId' | 'mtxKey' | 'mtxApiHost'>)
) &
  ClientOwnedConfig & { container?: HTMLElement };

export interface MarketrixWidgetPreviewProps {
  settings: WidgetSettingsData;
  container?: HTMLElement;
}

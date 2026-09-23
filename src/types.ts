/**
 * Widget-wide shared types: the config a host supplies, the chat message/part model, and the UI store
 * shape; `messageText` joins a message's text parts for display.
 * `MarketrixConfig` never carries a dashboard setting, since the api's settings always win, and `mtxApp` is
 * stamped only after credentials resolve, since a bare application id is guessable. `taskStatus` and
 * `MessagePart.status` are UI labels, not the `task/status` wire vocabulary.
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
  ClientOwnedConfig & { mtxId?: string; mtxKey?: string; mtxApp?: number; isPreviewMode: boolean };

type ScreenshareMessage = Omit<Extract<StoredMessage, { kind: 'system' }>, 'kind'> & {
  kind: 'screenshare';
  videoStream: MediaStream;
};

export type ChatMessage = StoredMessage | ScreenshareMessage;

export type AgentMessage = Extract<ChatMessage, { kind: 'agent' }>;

export type MessagePart = ChatMessage['parts'][number];

export const messageText = (parts: MessagePart[]): string =>
  parts
    .filter(part => part.type === 'text')
    .map(part => part.content)
    .join('\n');

export const WIDGET_VIEWS = ['home', 'chat'] as const;

export type WidgetView = (typeof WIDGET_VIEWS)[number];

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
      mtxApiHost?: never;
    }
  | ({ settings?: never } & Pick<MarketrixConfig, 'mtxId' | 'mtxKey' | 'mtxApiHost'>)
) &
  ClientOwnedConfig & { container?: HTMLElement };

export interface MarketrixWidgetPreviewProps {
  settings: WidgetSettingsData;
  container?: HTMLElement;
}

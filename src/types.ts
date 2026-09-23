/**
 * Widget-wide shared types: the config shapes a host supplies, the chat message/part model, and the UI
 * store shape. `messageText` joins a message's text parts into the string a render site displays.
 *
 * `MarketrixConfig` is what a host passes: credentials plus the client-owned options, never a dashboard
 * setting, since the api's settings always win. `ValidWidgetConfig` is the rendered config the runtime
 * reads; `mtxApp` is stamped only after the credentials resolve, since a bare application id is guessable.
 * `ChatMessage` is a stored message or a live screen share, which a reload cannot keep; `kind` is the one
 * discriminant. `taskStatus`/`MessagePart.status` are presentational labels only, not the `task/status`
 * wire vocabulary.
 */
import type { InstructionType, WidgetSettingsData } from './sdk';
import type { StoredMessage } from './services/StorageService';
import type { WidgetRenderedSettings } from './services/WidgetService';

export type { InstructionType, WidgetSettingsData } from './sdk';

export interface ClientOwnedConfig {
  mtxApiHost?: string;
  widget_position_z_index?: number;
  show_widget?: boolean;
  use_screenshare?: boolean;
  styleNonce?: string;
}

export type MarketrixConfig = ClientOwnedConfig & { mtxId: string; mtxKey: string };

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

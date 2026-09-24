/**
 * Shared test fixtures for widget tests. `getMockWidgetConfig`/`validSettings`/`credentialedConfig` build a
 * complete, schema-valid tenant config (preview and resolved-production shapes); `agentMessage` builds an
 * agent `ChatMessage` and `ofKind` narrows one; `mockMediaStream` stubs the browser's un-mockable
 * `MediaStream`; `asStreamClientInternals` reaches `streamClient`'s private `handleMessage`/`notifyError`
 * for simulating SSE events and stream failures.
 */
import { WidgetSettingsDataSchema } from '../sdk/contracts/widgetSettings';
import { streamClient } from '../services/StreamClient';
import type { CredentialedConfig } from '../services/WidgetService';
import type { AgentMessage, ChatMessage, ValidWidgetConfig, WidgetSettingsData } from '../types';

export function ofKind<K extends ChatMessage['kind']>(
  message: ChatMessage | undefined,
  kind: K,
): Extract<ChatMessage, { kind: K }> {
  if (message?.kind !== kind) throw new Error(`expected a ${kind} message, got ${message?.kind}`);
  return message as Extract<ChatMessage, { kind: K }>;
}

export const flushMicrotasks = (): Promise<void> => Promise.resolve();

export const mountTarget = (): HTMLDivElement => document.createElement('div');

export function agentMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: 'agent-1',
    kind: 'agent',
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    mode: 'do',
    status: 'thinking',
    parts: [{ type: 'text', content: 'Working on it' }],
    ...overrides,
  };
}

type MockWidgetConfig = ValidWidgetConfig &
  Pick<
    WidgetSettingsData,
    'widget_border_radius' | 'widget_font_size' | 'widget_animation_duration' | 'widget_fade_duration'
  >;

const WIDGET_SETTINGS = {
  widget_enabled: true,
  widget_appearance: 'default',
  widget_position: 'bottom_right',
  widget_header: 'Support',
  widget_body: 'How can we help?',
  widget_greeting: 'Hi! Need help?',
  widget_greeting_toast: true,
  widget_recording: false,
  widget_feature_tell: true,
  widget_feature_show: true,
  widget_feature_do: true,
  widget_background_color: '#111827',
  widget_text_color: '#f9fafb',
  widget_border_color: '#374151',
  widget_accent_color: '#3b82f6',
  widget_secondary_color: '#6b7280',
  widget_border_radius: '12px',
  widget_font_size: '14px',
  widget_width: '400px',
  widget_height: '600px',
  widget_animation_duration: '300ms',
  widget_fade_duration: '200ms',
  widget_chips: [],
} satisfies WidgetSettingsData;

export function getMockWidgetConfig(overrides: Partial<MockWidgetConfig> = {}): MockWidgetConfig {
  return {
    ...WIDGET_SETTINGS,
    widget_position_z_index: 1230,
    mtxId: 'test-id',
    mtxKey: 'test-key',
    isPreviewMode: true,
    ...overrides,
  };
}

export function validSettings(): WidgetSettingsData {
  return WidgetSettingsDataSchema.parse(WIDGET_SETTINGS);
}

export function credentialedConfig(overrides: Partial<CredentialedConfig> = {}): CredentialedConfig {
  return {
    ...validSettings(),
    mtxId: 'test-id',
    mtxKey: 'test-key',
    isPreviewMode: false,
    ...overrides,
  };
}

export function mockMediaStream(overrides: Record<string, unknown> = {}): MediaStream {
  return {
    active: true,
    getVideoTracks: () => [],
    getTracks: () => [],
    ...overrides,
  } as unknown as MediaStream;
}

interface StreamClientTestHandle {
  handleMessage: (typeof streamClient)['handleMessage'];
  notifyError: (typeof streamClient)['notifyError'];
}

export const asStreamClientInternals = (): StreamClientTestHandle => streamClient as unknown as StreamClientTestHandle;

/**
 * Shared test fixtures for widget tests. `getMockWidgetConfig`/`validSettings`/`credentialedConfig` build a
 * complete, schema-valid tenant config (preview and resolved-production shapes); `agentMessage` builds an
 * agent `ChatMessage` and `ofKind` narrows one; `toolCall` builds a `tool/call` event (a click by default);
 * `mockMediaStream`/`liveMediaStream` stub the browser's un-mockable `MediaStream`, `stubRect` gives every
 * element a layout jsdom lacks, `$` finds a tag or throws; `asStreamClientInternals` reaches `streamClient`'s
 * private state and handlers for simulating SSE events, stream failures and reconnects.
 */
import { vi } from 'bun:test';

import { WidgetSettingsDataSchema } from '../sdk/contracts/widgetSettings';
import type { WidgetToolCall } from '../services/browserTools';
import { streamClient } from '../services/StreamClient';
import type { CredentialedConfig } from '../services/WidgetService';
import type { AgentMessage, ChatMessage, ValidWidgetConfig, WidgetSettingsData } from '../types';

type ToolAndArgs = WidgetToolCall extends infer Call
  ? Call extends WidgetToolCall
    ? Pick<Call, 'browser_tool' | 'args'>
    : never
  : never;

export function toolCall(
  overrides: Partial<Pick<WidgetToolCall, 'tool_call_id' | 'mode' | 'explanation'>> = {},
  tool: ToolAndArgs = { browser_tool: 'click_element', args: { index: 1 } },
): WidgetToolCall {
  return {
    type: 'tool/call',
    tool_call_id: 'call-1',
    mode: 'do',
    explanation: 'Clicking the submit button',
    ...overrides,
    ...tool,
  };
}

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

export const liveMediaStream = (): MediaStream =>
  mockMediaStream({
    getVideoTracks: () => [{ readyState: 'live', addEventListener: vi.fn() }],
    getTracks: () => [{ stop: vi.fn() }],
  });

export function stubRect(rect: Partial<DOMRect> = { top: 0, left: 0, width: 10, height: 10 }): void {
  Element.prototype.getBoundingClientRect = () => rect as DOMRect;
}

export function $<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  root: ParentNode = document,
): HTMLElementTagNameMap[K] {
  const element = root.querySelector(tag);
  if (!element) throw new Error(`no <${tag}> under the given root`);
  return element;
}

type StreamClient = typeof streamClient;

interface StreamClientTestHandle {
  chatId: StreamClient['chatId'];
  status: StreamClient['status'];
  tornDown: StreamClient['tornDown'];
  credentialRejected: StreamClient['credentialRejected'];
  reconnectAttempts: StreamClient['reconnectAttempts'];
  scheduleReconnect: StreamClient['scheduleReconnect'];
  handleMessage: StreamClient['handleMessage'];
  isConnected: StreamClient['isConnected'];
  notifyError: StreamClient['notifyError'];
  giveUp: (message: string) => void;
}

export const asStreamClientInternals = (): StreamClientTestHandle => streamClient as unknown as StreamClientTestHandle;

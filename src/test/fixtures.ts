/**
 * Shared test fixtures for widget tests. `getMockWidgetConfig`/`validSettings`/`credentialedConfig`
 * build a complete, schema-valid tenant config (preview and resolved-production shapes); `agentMessage`
 * builds a `ChatMessage`; `mockMediaStream` stubs the browser's un-mockable `MediaStream`;
 * `asStreamClientInternals` reaches `streamClient`'s private `handleMessage`/`notifyError` for
 * simulating SSE events and stream failures; `browserToolServiceMock` shapes the
 * `vi.mock('.../BrowserToolService', ...)` factory.
 */
import { WidgetSettingsDataSchema } from '../sdk';
import { type BrowserToolService, FINISH_TOOL } from '../services/BrowserToolService';
import type { CredentialedConfig } from '../services/StorageService';
import { type StreamClient, streamClient } from '../services/StreamClient';
import type { ChatMessage, ValidWidgetConfig, WidgetSettingsData } from '../types';

export const flushMicrotasks = (): Promise<void> => Promise.resolve();

export const mountTarget = (): HTMLDivElement => document.createElement('div');

export function agentMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'agent-1',
    sender: 'agent',
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    mode: 'do',
    isPlaceholder: true,
    placeholderState: 'thinking',
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
    mtxApiHost: 'https://api.test',
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
    mtxApp: 1,
    isPreviewMode: false,
    ...overrides,
  } as CredentialedConfig;
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
  handleMessage: StreamClient['handleMessage'];
  notifyError: StreamClient['notifyError'];
}

export const asStreamClientInternals = (): StreamClientTestHandle => streamClient as unknown as StreamClientTestHandle;

type MockedBrowserToolService = Pick<BrowserToolService, 'executeTool' | 'getFriendlyToolName' | 'isWaitForUserTool'>;

export function browserToolServiceMock(executeTool: BrowserToolService['executeTool']) {
  const browserToolService: MockedBrowserToolService = {
    executeTool,
    getFriendlyToolName: name => name,
    isWaitForUserTool: () => false,
  };
  return { browserToolService, FINISH_TOOL };
}

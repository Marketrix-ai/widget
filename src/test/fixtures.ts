/**
 * The shared widget-settings fixture the config-driven tests build from: `getMockWidgetConfig(overrides)`
 * returns a complete, schema-valid tenant config — every rendered setting plus the `mtxId`/`mtxKey`
 * credential, api host and preview flag — shallow-merged with `overrides`. It's `MockWidgetConfig`, wider
 * than `WidgetRenderedSettings`, since callers hand it straight to `WidgetSettingsDataSchema.parse()`,
 * which demands the four render constants that schema omits.
 *
 * `validSettings(overrides)` is the parsed form most call sites want, living here so the schema import
 * stays confined to test-only files; `validation.test.ts` keeps its own inline parse since there the
 * schema IS the thing under test. `mountTarget()` is a fresh detached `<div>` (a new one per call, so
 * reuse across containers in one test is still correct); `flushMicrotasks` names the common
 * one-microtask-tick wait explicitly.
 *
 * `agentMessage(overrides)` is the shared `ChatMessage` builder for tests that need one without caring
 * about its exact shape. `credentialedConfig(overrides)` is `validSettings()` plus the
 * `mtxId`/`mtxKey`/`mtxApp` triple and `isPreviewMode: false` a resolved PRODUCTION config carries — the
 * real shape `WidgetService.loadWidgetConfig` resolves to, so a mock never hides a field it forgets to set.
 *
 * `mockMediaStream(overrides)` is the one home for the browser's un-mockable `MediaStream`: the DOM lib
 * type has no constructor a test can call, so every caller needs the same `as unknown as MediaStream`
 * bridge — centralizing it here means that bridge exists exactly once instead of once per test file.
 *
 * `asStreamClientInternals()` is the one cast for reaching `streamClient`'s private `handleMessage`
 * (simulate an incoming SSE event) and `notifyError` (simulate a connect/stream failure reaching every
 * registered `onError` callback, the same path a real failed dial or dropped stream takes) —
 * `streamClient` is a class instance, so (unlike `mockSdkModule` in `vi-compat.ts`) the value itself
 * can't be typed against the real module without an `as unknown as` cast past TypeScript's privacy
 * check; each field is still typed as `StreamClient['handleMessage']`/`StreamClient['notifyError']`,
 * not a hand-written signature, so a real parameter/return change on either method is a type error here
 * too instead of a silently stale mock. `browserToolServiceMock(executeTool)`
 * is the one home for the `vi.mock('.../BrowserToolService', ...)` factory shape, typed as
 * `Pick<BrowserToolService, 'executeTool' | 'getFriendlyToolName' | 'isWaitForUserTool'>` — the class's
 * unrelated private fields (`tools`, `element`, `selectElement`) don't block `Pick` over its public
 * surface, so no `as unknown as` is needed here, unlike `StreamClient`'s handle above. It imports the
 * real `FINISH_TOOL` rather than re-literalling `'finish'`, which `sourceInvariants.test.ts` bans
 * outside `BrowserToolService.ts` itself.
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

export function getMockWidgetConfig(overrides: Partial<MockWidgetConfig> = {}): MockWidgetConfig {
  return {
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
    widget_position_z_index: 1230,
    mtxId: 'test-id',
    mtxKey: 'test-key',
    mtxApiHost: 'https://api.test',
    isPreviewMode: true,
    ...overrides,
  };
}

export function validSettings(overrides: Partial<MockWidgetConfig> = {}): WidgetSettingsData {
  return WidgetSettingsDataSchema.parse(getMockWidgetConfig(overrides));
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

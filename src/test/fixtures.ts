/**
 * The shared widget-settings fixture the config-driven tests build from: `getMockWidgetConfig(overrides)`
 * returns a complete, schema-valid tenant config — every rendered setting plus the `mtxId`/`mtxKey` credential,
 * api host and preview flag a mounted widget needs — shallow-merged with `overrides`.
 *
 * `MockWidgetConfig` widens `ValidWidgetConfig` with the four render constants (`widget_border_radius`,
 * `widget_font_size`, `widget_animation_duration`, `widget_fade_duration`). `ValidWidgetConfig` is built on
 * `WidgetRenderedSettings`, which omits them, but callers hand this fixture straight to
 * `WidgetSettingsDataSchema.parse()`, which demands the whole wire shape. It is `Valid`, not partial, so
 * `renderWidget` can hand it to `WidgetRoot` without a cast — the fixture really does set every field.
 *
 * `validSettings(overrides)` is the parsed form most call sites actually want —
 * `WidgetSettingsDataSchema.parse(getMockWidgetConfig(overrides))` — and lives here rather than at each
 * call site so the schema import stays confined to test-only files even where it is used repeatedly.
 * `validation.test.ts` keeps its own inline parse: there the schema is the oracle under test, not fixture
 * noise.
 *
 * `mountTarget()` names the other repeated pattern, a fresh detached `<div>` to mount or render into —
 * every call yields an independent element, so using it more than once in one test for distinct
 * containers is still correct.
 *
 * `flushMicrotasks` names the common one-microtask-tick wait (`await Promise.resolve()`) explicitly, for
 * tests that need pending promise callbacks to settle before asserting.
 *
 * `agentMessage(overrides)` is the shared `ChatMessage` builder — an agent bubble with id `agent-1`, a
 * single text part echoing `content`, and a fixed `timestamp` — for every test that needs one message
 * without caring about its exact shape; a test asserting placeholder/mode semantics overrides those
 * fields explicitly.
 */
import { WidgetSettingsDataSchema } from '../sdk';
import type { ChatMessage, ValidWidgetConfig, WidgetSettingsData } from '../types';

export const flushMicrotasks = (): Promise<void> => Promise.resolve();

export const mountTarget = (): HTMLDivElement => document.createElement('div');

export function agentMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'agent-1',
    content: 'Working on it',
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

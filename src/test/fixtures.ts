/**
 * Shared test fixtures for widget tests. `getMockWidgetConfig`/`validSettings`/`credentialedConfig` build a complete,
 * schema-valid tenant config (preview and resolved-production shapes); `agentMessage` builds an agent `ChatMessage` and
 * `ofKind` narrows one; `freshCopyOf` proves a cache-busted re-import exports what the real module does; `toolCall` builds a `tool/call` event (a click by default); `mockMediaStream`/`liveMediaStream`
 * stub the browser's un-mockable `MediaStream`, `stubRect` gives every element a layout jsdom lacks, `$` finds an
 * element by tag or selector or throws; `asStreamClientInternals` reaches `streamClient`'s private state and handlers
 * for simulating SSE events, stream failures and reconnects.
 */
import { vi } from 'bun:test';

import { WidgetSettingsDataSchema } from '../sdk/contracts/widgetSettings';
import type { WidgetToolCall } from '../services/browserTools';
import { streamClient, type StreamState } from '../services/StreamClient';
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

const isKind = <K extends ChatMessage['kind']>(
  message: ChatMessage,
  kind: K,
): message is Extract<ChatMessage, { kind: K }> => message.kind === kind;

export function ofKind<K extends ChatMessage['kind']>(
  message: ChatMessage | undefined,
  kind: K,
): Extract<ChatMessage, { kind: K }> {
  if (!message || !isKind(message, kind)) throw new Error(`expected a ${kind} message, got ${message?.kind}`);
  return message;
}

const hasExportsOf = <T extends object>(fresh: unknown, real: T): fresh is T =>
  typeof fresh === 'object' &&
  fresh !== null &&
  Object.keys(real).every(name => typeof Reflect.get(fresh, name) === typeof Reflect.get(real, name));

export function freshCopyOf<T extends object>(fresh: unknown, real: T): T {
  if (!hasExportsOf(fresh, real)) throw new Error('the re-imported module does not export what the real one does');
  return fresh;
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

export class FakeTrack extends EventTarget implements MediaStreamTrack {
  contentHint = '';
  enabled = true;
  id = 'track-1';
  kind = 'video';
  label = 'screen';
  muted = false;
  onended = null;
  onmute = null;
  onunmute = null;
  readyState: MediaStreamTrackState = 'live';
  stop = vi.fn();
  applyConstraints = async (): Promise<void> => {};
  clone = (): FakeTrack => new FakeTrack();
  getCapabilities = (): MediaTrackCapabilities => ({});
  getConstraints = (): MediaTrackConstraints => ({});
  getSettings = (): MediaTrackSettings => ({});

  end(): void {
    this.readyState = 'ended';
    this.dispatchEvent(new Event('ended'));
  }
}

export class FakeMediaStream extends EventTarget implements MediaStream {
  active = true;
  id = 'stream-1';
  onaddtrack = null;
  onremovetrack = null;

  constructor(readonly tracks: FakeTrack[] = [new FakeTrack()]) {
    super();
  }

  getTracks = (): FakeTrack[] => this.tracks;
  getVideoTracks = (): FakeTrack[] => this.tracks.filter(track => track.kind === 'video');
  getAudioTracks = (): FakeTrack[] => this.tracks.filter(track => track.kind === 'audio');
  getTrackById = (id: string): FakeTrack | null => this.tracks.find(track => track.id === id) ?? null;
  addTrack = (track: FakeTrack): void => void this.tracks.push(track);
  removeTrack = (track: FakeTrack): void => void this.tracks.splice(this.tracks.indexOf(track), 1);
  clone = (): FakeMediaStream => new FakeMediaStream([...this.tracks]);
}

export function stubRect(rect: Partial<DOMRect> = { top: 0, left: 0, width: 10, height: 10 }): void {
  const { top = 0, left = 0, width = 0, height = 0, right = left + width, bottom = top + height } = rect;
  Element.prototype.getBoundingClientRect = () => ({
    top,
    left,
    width,
    height,
    right,
    bottom,
    x: left,
    y: top,
    toJSON: () => rect,
  });
}

type Found<S extends string> = S extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[S] : HTMLElement;

export function $<S extends string>(selector: S, root: ParentNode = document): Found<S> {
  const element = root.querySelector<Found<S>>(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`no HTML element matches ${selector} under the given root`);
  return element;
}

type StreamClient = typeof streamClient;

interface StreamClientTestHandle {
  state: StreamState;
  handleMessage: StreamClient['handleMessage'];
  backoff: StreamClient['backoff'];
}

export const asStreamClientInternals = (): StreamClientTestHandle => ({
  get state() {
    return streamClient.getState();
  },
  set state(value) {
    streamClient['transition'](value);
  },
  handleMessage: event => streamClient['handleMessage'](event),
  backoff: (chatId, failed) => streamClient['backoff'](chatId, failed),
});

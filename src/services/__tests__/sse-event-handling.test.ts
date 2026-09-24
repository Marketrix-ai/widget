/**
 * Contract tests for `WidgetEventSchema`/`WidgetCommandSchema`, the SSE and POST discriminated unions:
 * every documented type parses from a minimal fixture, and an unknown or missing `type` is rejected.
 */
import { describe, expect, it } from 'bun:test';

import { WidgetCommandSchema, type WidgetEvent, WidgetEventSchema } from '../../sdk/contracts/widget';

const ALL_WIDGET_EVENT_TYPES = [
  'registered',
  'heartbeat',
  'chat/response',
  'chat/delta',
  'chat/error',
  'task/status',
  'tool/call',
] as const;

type ExpectedEventType = (typeof ALL_WIDGET_EVENT_TYPES)[number];

const MINIMAL_EVENT_FIXTURES: Record<ExpectedEventType, object> = {
  registered: { type: 'registered', chat_id: 'chat-001' },
  heartbeat: { type: 'heartbeat' },
  'chat/response': { type: 'chat/response', request_id: 'req-1', text: 'Hello!' },
  'chat/delta': { type: 'chat/delta', request_id: 'req-1', text: 'Hel' },
  'chat/error': { type: 'chat/error', request_id: 'req-2', error: 'Something went wrong' },
  'task/status': { type: 'task/status', status: 'running' },
  'tool/call': {
    type: 'tool/call',
    tool_call_id: 'call-1',
    browser_tool: 'click_element',
    args: { index: 1 },
  },
};

describe('SSE event discriminated-union contract (WidgetEventSchema)', () => {
  describe('all event types are present in the union', () => {
    it.each([...ALL_WIDGET_EVENT_TYPES])('event type "%s" is a valid WidgetEvent', (eventType: ExpectedEventType) => {
      const fixture = MINIMAL_EVENT_FIXTURES[eventType];
      const result = WidgetEventSchema.safeParse(fixture);
      expect(
        result.success,
        `expected type="${eventType}" to be valid; errors: ${!result.success ? JSON.stringify(result.error.issues) : 'none'}`,
      ).toBe(true);
    });
  });

  describe('discriminant field "type" is mandatory on every event', () => {
    it('rejects an event with no type field', () => {
      const result = WidgetEventSchema.safeParse({ status: 'running' });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown type value', () => {
      const result = WidgetEventSchema.safeParse({ type: 'unknown/event', data: 'x' });
      expect(result.success).toBe(false);
    });

    it('every valid parsed event has a string type field', () => {
      for (const fixture of Object.values(MINIMAL_EVENT_FIXTURES)) {
        const result = WidgetEventSchema.safeParse(fixture);
        if (result.success) {
          const event: WidgetEvent = result.data;
          expect(typeof event.type).toBe('string');
          expect(event.type.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('registered event', () => {
    it('requires chat_id', () => {
      const withoutChatId = { type: 'registered' };
      expect(WidgetEventSchema.safeParse(withoutChatId).success).toBe(false);
    });
  });

  describe('chat/response event', () => {
    it('requires request_id and text', () => {
      expect(WidgetEventSchema.safeParse({ type: 'chat/response', request_id: 'r1' }).success).toBe(false);
      expect(WidgetEventSchema.safeParse({ type: 'chat/response', text: 'hi' }).success).toBe(false);
      expect(WidgetEventSchema.safeParse({ type: 'chat/response', request_id: 'r1', text: 'hi' }).success).toBe(true);
    });
  });

  describe('task/status event', () => {
    it('requires status field', () => {
      expect(WidgetEventSchema.safeParse({ type: 'task/status' }).success).toBe(false);
    });

    it.each(['running', 'completed', 'failed', 'stopped', 'has_question'] as const)('accepts "%s"', status => {
      expect(WidgetEventSchema.safeParse({ type: 'task/status', status }).success).toBe(true);
    });

    it('all optional fields parse correctly', () => {
      const full = { type: 'task/status', status: 'completed', message: 'Task done' };
      expect(WidgetEventSchema.safeParse(full).success).toBe(true);
    });
  });

  describe('tool/call event', () => {
    it('requires tool_call_id, browser_tool, and args', () => {
      const base = {
        type: 'tool/call',
        tool_call_id: 'c1',
        browser_tool: 'navigate',
        args: { url: 'https://example.com', new_tab: false },
      };
      expect(WidgetEventSchema.safeParse(base).success).toBe(true);
      expect(WidgetEventSchema.safeParse({ ...base, tool_call_id: undefined }).success).toBe(false);
    });

    it('uses the generated done tool as the task-finishing primitive', () => {
      const event = WidgetEventSchema.parse({
        type: 'tool/call',
        tool_call_id: 'c1',
        browser_tool: 'done',
        args: { message: 'Done', success: true },
      });
      expect(event.type === 'tool/call' && event.browser_tool).toBe('done');
    });

    it('mode is optional and restricted to "show"|"do"', () => {
      const base = {
        type: 'tool/call',
        tool_call_id: 'c1',
        browser_tool: 'navigate',
        args: { url: 'https://example.com', new_tab: false },
      };
      expect(WidgetEventSchema.safeParse({ ...base, mode: 'show' }).success).toBe(true);
      expect(WidgetEventSchema.safeParse({ ...base, mode: 'do' }).success).toBe(true);
      expect(WidgetEventSchema.safeParse({ ...base, mode: 'auto' }).success).toBe(false);
    });
  });

  describe('StreamClient heartbeat/registered handling (integration with schema)', () => {
    it('heartbeat parses as a valid event (StreamClient ignores it silently)', () => {
      const result = WidgetEventSchema.safeParse({ type: 'heartbeat' });
      expect(result.success).toBe(true);
    });

    it('chat/error with request_id "auth" parses as valid (non-retriable auth error path)', () => {
      const result = WidgetEventSchema.safeParse({
        type: 'chat/error',
        request_id: 'auth',
        error: 'Authentication failed',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('chat/error');
      }
    });
  });

  describe('WidgetCommandSchema (POST, widget -> server)', () => {
    it.each([
      ['chat/tell', { type: 'chat/tell', request_id: 'r1', content: 'hi' }],
      ['chat/show', { type: 'chat/show', request_id: 'r1', content: 'hi' }],
      ['chat/do', { type: 'chat/do', request_id: 'r1', content: 'hi' }],
      ['chat/stop', { type: 'chat/stop' }],
      ['tool/response', { type: 'tool/response', tool_call_id: 'c1', success: true }],
      ['rrweb/metadata', { type: 'rrweb/metadata', rrweb_session_id: 's1' }],
      ['rrweb/events', { type: 'rrweb/events', rrweb_session_id: 's1', events: [] }],
    ] as const)('accepts a minimal "%s" command', (_type, fixture) => {
      expect(WidgetCommandSchema.safeParse(fixture).success).toBe(true);
    });

    it('rejects an unknown command type', () => {
      expect(WidgetCommandSchema.safeParse({ type: 'chat/nonexistent' }).success).toBe(false);
    });

    it('rejects rrweb/metadata carrying an application_id', () => {
      const metadata = { type: 'rrweb/metadata', rrweb_session_id: 's1', application_id: 1 };
      expect(WidgetCommandSchema.safeParse(metadata).success).toBe(false);
    });
  });
});

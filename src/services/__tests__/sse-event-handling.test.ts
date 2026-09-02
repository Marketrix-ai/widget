import { describe, expect, it } from 'vitest';

import { type WidgetEvent, WidgetEventSchema } from '@/sdk';

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
    args: { selector: '#btn' },
  },
};

describe('SSE event discriminated-union contract (WidgetEventSchema)', () => {
  describe('all event types are present in the union', () => {
    it.each(ALL_WIDGET_EVENT_TYPES)('event type "%s" is a valid WidgetEvent', eventType => {
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

    it('application_id is optional', () => {
      const withAppId = { type: 'registered', chat_id: 'c1', application_id: 42 };
      const withoutAppId = { type: 'registered', chat_id: 'c1' };
      expect(WidgetEventSchema.safeParse(withAppId).success).toBe(true);
      expect(WidgetEventSchema.safeParse(withoutAppId).success).toBe(true);
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

    // Wave 14 canonical wire vocab; has_question is the sim-only pause propagated to the widget.
    it.each(['running', 'completed', 'failed', 'stopped', 'has_question'] as const)('accepts "%s"', status => {
      expect(WidgetEventSchema.safeParse({ type: 'task/status', status }).success).toBe(true);
    });

    it.each(['started', 'in_progress'] as const)('REJECTS legacy "%s" (BREAKING contract change)', status => {
      expect(WidgetEventSchema.safeParse({ type: 'task/status', status }).success).toBe(false);
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
        args: { url: 'https://example.com' },
      };
      expect(WidgetEventSchema.safeParse(base).success).toBe(true);
      expect(WidgetEventSchema.safeParse({ ...base, tool_call_id: undefined }).success).toBe(false);
    });

    it('mode is optional and restricted to "show"|"do"', () => {
      const base = { type: 'tool/call', tool_call_id: 'c1', browser_tool: 'navigate', args: {} };
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
});

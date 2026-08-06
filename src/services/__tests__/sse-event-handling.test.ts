// Characterization tests for the SSE discriminated-union contract: WidgetEventSchema is the canonical runtime validator; task/status union = `'running' | 'completed' | 'failed' | 'stopped' | 'has_question'`.

import { describe, expect, it } from 'vitest';

import { type WidgetEvent, WidgetEventSchema } from '@/sdk';
import type { ChatMessage } from '@/types';
import { hasThinkingMarker, updateThinkingMarker } from '@/utils/chat';

// All event types present in the discriminated union — pin this set.
const ALL_WIDGET_EVENT_TYPES = [
  'registered',
  'heartbeat',
  'chat/response',
  'chat/error',
  'task/status',
  'tool/call',
] as const;

type ExpectedEventType = (typeof ALL_WIDGET_EVENT_TYPES)[number];

const MINIMAL_EVENT_FIXTURES: Record<ExpectedEventType, object> = {
  registered: { type: 'registered', chat_id: 'chat-001' },
  heartbeat: { type: 'heartbeat' },
  'chat/response': { type: 'chat/response', request_id: 'req-1', text: 'Hello!' },
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

    it('"running" is a valid status (Wave 14 canonical wire vocab)', () => {
      const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'running' });
      expect(result.success).toBe(true);
    });

    it('legacy "started" is REJECTED post-Wave-14 (BREAKING contract change)', () => {
      const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'started' });
      expect(result.success).toBe(false);
    });

    it('legacy "in_progress" is REJECTED post-Wave-14 (BREAKING contract change)', () => {
      const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'in_progress' });
      expect(result.success).toBe(false);
    });

    it('"has_question" remains a valid status (sim-only state propagated to widget)', () => {
      const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'has_question' });
      expect(result.success).toBe(true);
    });

    it('all optional fields parse correctly', () => {
      const full = {
        type: 'task/status',
        status: 'completed',
        message: 'Task done',
        task_id: 'task-xyz',
        timestamp: 1700000000,
      };
      const result = WidgetEventSchema.safeParse(full);
      expect(result.success).toBe(true);
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

  describe('task/status "has_question" pauses the active message (clears running spinner)', () => {
    // Mirrors the ChatContext `has_question` reducer: strip the thinking marker (stops spinner), flip to "waiting-for-user", no terminal taskStatus icon.
    const applyHasQuestionTransition = (message: ChatMessage, statusMessage?: string): ChatMessage => {
      const cleared = updateThinkingMarker(message, false, 'do');
      return {
        ...cleared,
        placeholderState: 'waiting-for-user',
        ...(statusMessage && { content: statusMessage }),
      };
    };

    const runningMessage = (): ChatMessage => ({
      id: 'm1',
      content: 'Working on it\n\n__THINKING__',
      sender: 'agent',
      timestamp: new Date(),
      mode: 'do',
      placeholderState: 'thinking',
      taskStatus: 'ongoing',
    });

    it('"has_question" is a valid SSE event that carries an optional message', () => {
      const event = { type: 'task/status', status: 'has_question', message: 'Which account?' };
      const result = WidgetEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('removes the thinking marker so the inline spinner stops', () => {
      const before = runningMessage();
      expect(hasThinkingMarker(before.content)).toBe(true);
      const after = applyHasQuestionTransition(before);
      expect(hasThinkingMarker(after.content)).toBe(false);
    });

    it('flips the message to "waiting-for-user" (paused, not terminal)', () => {
      const after = applyHasQuestionTransition(runningMessage());
      expect(after.placeholderState).toBe('waiting-for-user');
      // Terminal icon statuses must NOT be applied — the task is paused, not finished.
      expect(after.taskStatus).not.toBe('done');
      expect(after.taskStatus).not.toBe('failed');
      expect(after.taskStatus).not.toBe('stopped');
    });

    it('surfaces the question text when the event includes a message', () => {
      const after = applyHasQuestionTransition(runningMessage(), 'Which account?');
      expect(after.content).toContain('Which account?');
      expect(hasThinkingMarker(after.content)).toBe(false);
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

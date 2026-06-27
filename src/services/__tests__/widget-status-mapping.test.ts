/**
 * Widget task-status contract — the event-surface vocabulary carried by WidgetEventSchema.
 * Widget `task/status` union: `'running' | 'completed' | 'failed' | 'stopped' | 'has_question'`.
 */
import { describe, expect, it } from 'vitest';

import { WidgetEventSchema } from '@/sdk';

describe('widget event surface (WidgetEventSchema.task/status)', () => {
  const WIDGET_TASK_STATUSES = ['running', 'completed', 'failed', 'stopped', 'has_question'] as const;

  it('union has exactly 5 values', () => {
    expect(WIDGET_TASK_STATUSES.length).toBe(5);
  });

  it('"running" replaces legacy "started"', () => {
    expect(WIDGET_TASK_STATUSES).toContain('running');
    expect(WIDGET_TASK_STATUSES as readonly string[]).not.toContain('started');
  });

  it('"in_progress" is no longer a valid widget task status', () => {
    expect(WIDGET_TASK_STATUSES as readonly string[]).not.toContain('in_progress');
  });

  it.each(WIDGET_TASK_STATUSES)('schema accepts "%s" as a valid task/status', status => {
    const result = WidgetEventSchema.safeParse({ type: 'task/status', status });
    expect(
      result.success,
      `expected status="${status}" to be accepted; errors: ${
        !result.success ? JSON.stringify(result.error.issues) : 'none'
      }`,
    ).toBe(true);
  });

  it('schema REJECTS legacy "started"', () => {
    const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'started' });
    expect(result.success).toBe(false);
  });

  it('schema REJECTS legacy "in_progress"', () => {
    const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'in_progress' });
    expect(result.success).toBe(false);
  });
});

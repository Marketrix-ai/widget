// Widget task-status contract (WidgetEventSchema): `task/status` union = `'running' | 'completed' | 'failed' | 'stopped' | 'has_question'`.
import { describe, expect, it } from 'vitest';

import { WidgetEventSchema } from '@/sdk';

describe('widget event surface (WidgetEventSchema.task/status)', () => {
  const WIDGET_TASK_STATUSES = ['running', 'completed', 'failed', 'stopped', 'has_question'] as const;

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

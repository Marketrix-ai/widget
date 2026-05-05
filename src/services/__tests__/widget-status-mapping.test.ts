/**
 * Widget task status contract — aligns with SimulationTaskStatus / QATaskStatus.
 * Widget `task/status` union: `'running' | 'completed' | 'failed' | 'stopped' | 'has_question'`.
 */
import { describe, expect, it } from 'vitest';

import { WidgetEventSchema } from '@/sdk/schema';

describe('Widget task status contract — Wave 14 (C1 cutover)', () => {
  const SIM_TASK_STATUSES = ['queued', 'running', 'completed', 'failed', 'has_question', 'stopped'] as const;

  const QA_TASK_STATUSES = ['queued', 'running', 'passed', 'failed', 'needs_healing', 'stopped'] as const;

  // Canonical post-Wave-14 set carried by WidgetEventSchema.task/status.
  const WIDGET_TASK_STATUSES = ['running', 'completed', 'failed', 'stopped', 'has_question'] as const;

  it('sim task statuses include all 6 expected values', () => {
    expect(SIM_TASK_STATUSES.length).toBe(6);
    expect(SIM_TASK_STATUSES).toContain('running');
    expect(SIM_TASK_STATUSES).toContain('has_question');
  });

  it('QA task statuses include all 6 expected values', () => {
    expect(QA_TASK_STATUSES.length).toBe(6);
    expect(QA_TASK_STATUSES).toContain('passed');
    expect(QA_TASK_STATUSES).toContain('needs_healing');
  });

  it('sim task uses "running" not "started" (Wave 8a rename)', () => {
    expect(SIM_TASK_STATUSES).toContain('running');
    expect(SIM_TASK_STATUSES as readonly string[]).not.toContain('started');
  });

  it('QA task does not have "completed" (uses passed/failed instead)', () => {
    expect(QA_TASK_STATUSES as readonly string[]).not.toContain('completed');
  });

  it('QA task does not have "has_question" (sim-only)', () => {
    expect(QA_TASK_STATUSES as readonly string[]).not.toContain('has_question');
  });

  // Wave 14 (C1): widget event-surface vocabulary alignment.
  describe('widget event surface (WidgetEventSchema.task/status)', () => {
    it('post-Wave-14 union has exactly 5 values', () => {
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

    it('schema REJECTS legacy "started" (Wave 14 contract change)', () => {
      const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'started' });
      expect(result.success).toBe(false);
    });

    it('schema REJECTS legacy "in_progress" (Wave 14 contract change)', () => {
      const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'in_progress' });
      expect(result.success).toBe(false);
    });
  });
});

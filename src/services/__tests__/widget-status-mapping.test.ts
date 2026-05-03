/**
 * Wave 14 (C1 cutover): widget task status now matches the canonical wire
 * vocabulary. Pre-Wave-14 the widget event surface still emitted the legacy
 * `'started'` / `'in_progress'` strings; Wave 14 drops them and aligns the
 * widget's `task/status` discriminator with `SimulationTaskStatus` /
 * `QATaskStatus` (specifically: `'running'` replaces `'started'`, and
 * `'in_progress'` is removed).
 *
 * Pre-Wave-8a: widget had its own task status set ('started', 'completed', 'failed', 'stopped').
 * Wave 8a: api split sims/QA into two distinct wire vocabularies — sim tasks
 *   emit `SimulationTaskStatus`, QA tasks emit `QATaskStatus`. The widget event
 *   surface was deliberately left on the legacy enum at that time.
 * Wave 14 (C1): widget event surface aligns with the canonical wire vocab —
 *   `'started'` and `'in_progress'` are dropped from `WidgetEventSchema`.
 *
 * `'has_question'` (sim only) and `'passed'` / `'needs_healing'` (QA only) remain
 * valid wire values per their respective enums.
 *
 * BREAKING CHANGE for external widget consumers — published in widget v3.3.160.
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

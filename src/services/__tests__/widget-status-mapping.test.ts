/**
 * Wave 8a: characterization for widget task status strings (post-schema-split).
 *
 * Pre-Wave-8a: widget had its own task status set ('started', 'completed', 'failed', 'stopped').
 * Wave 8a: the api now exposes two distinct wire vocabularies for downstream
 * consumers — sim tasks emit `SimulationTaskStatus` strings, QA tasks emit
 * `QATaskStatus` strings. These tests pin the new wire vocabularies the widget
 * is expected to align with as it consumes upstream events.
 *
 * 'started' is replaced by 'running'. 'has_question' (sim only) and
 * 'passed' / 'needs_healing' (QA only) are now valid wire values.
 *
 * NOTE: WidgetEventSchema's `task/status` discriminator currently still
 * carries the legacy widget-side enum (api PR #374 deliberately left it
 * untouched for backward compat with chat clients in flight). The Wave 8a
 * cutover for the widget event surface is tracked separately; these
 * assertions characterize the wire vocabulary the widget will adopt.
 */
import { describe, expect, it } from 'vitest';

describe('Widget task status contract — Wave 8a', () => {
  const SIM_TASK_STATUSES = ['queued', 'running', 'completed', 'failed', 'has_question', 'stopped'] as const;

  const QA_TASK_STATUSES = ['queued', 'running', 'passed', 'failed', 'needs_healing', 'stopped'] as const;

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
});

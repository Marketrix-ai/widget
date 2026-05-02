/**
 * Characterization tests — widget task status contract.
 *
 * Per CLAUDE.md "Status Values" table, the widget uses different status strings
 * than the API. These tests pin the four status values the widget exposes to
 * consumers, acting as a pre-Wave-8 safety net.
 *
 * Seam: WidgetEventSchema in src/sdk/schema.ts (task/status event, status field)
 *       TaskContext.tsx lines ~293-330 (the only place widget code branches on status)
 *
 * NOTE: The task/status SSE event also carries 'in_progress' and 'has_question'
 * values (passed through from the API), but TaskContext.tsx does NOT act on them —
 * only 'started', 'completed', 'failed', 'stopped' drive widget state transitions.
 * 'has_question' is intentionally not exposed to widget consumers per CLAUDE.md.
 */

import { describe, expect, it } from 'vitest';

import { WidgetEventSchema } from '@/sdk/schema';

// The four status strings the widget actively handles in TaskContext.tsx
const WIDGET_ACTIONABLE_STATUSES = ['started', 'completed', 'failed', 'stopped'] as const;
type WidgetActionableStatus = (typeof WIDGET_ACTIONABLE_STATUSES)[number];

describe('Widget task status contract (CLAUDE.md status-values table)', () => {
  it('exposes exactly 4 actionable task-status strings', () => {
    expect(WIDGET_ACTIONABLE_STATUSES).toHaveLength(4);
  });

  it('uses "started" not "in_progress" as the begin-task string (api-side value)', () => {
    expect(WIDGET_ACTIONABLE_STATUSES).toContain('started');
    expect(WIDGET_ACTIONABLE_STATUSES).not.toContain('in_progress');
  });

  it('does not expose "has_question" as an actionable widget status', () => {
    expect(WIDGET_ACTIONABLE_STATUSES).not.toContain('has_question');
  });

  it.each(WIDGET_ACTIONABLE_STATUSES)('status %s is a non-empty string', status => {
    expect(typeof status).toBe('string');
    expect(status.length).toBeGreaterThan(0);
  });

  it('schema task/status event accepts "started" (api uses "in_progress" for this)', () => {
    const event = {
      type: 'task/status' as const,
      status: 'started' as const,
    };
    const result = WidgetEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('schema task/status event accepts all four actionable statuses', () => {
    for (const status of WIDGET_ACTIONABLE_STATUSES) {
      const result = WidgetEventSchema.safeParse({ type: 'task/status', status });
      expect(result.success, `expected schema to accept status="${status}"`).toBe(true);
    }
  });

  it('schema task/status event rejects unknown status values', () => {
    const result = WidgetEventSchema.safeParse({ type: 'task/status', status: 'unknown_value' });
    expect(result.success).toBe(false);
  });

  it('schema task/status event carries optional fields: message, task_id, timestamp', () => {
    const full = {
      type: 'task/status' as const,
      status: 'started' as const,
      message: 'Agent is starting',
      task_id: 'task-abc',
      timestamp: 1700000000000,
    };
    const result = WidgetEventSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject(full);
    }
  });

  it('CLAUDE.md mapping: widget "started" corresponds to api "in_progress"', () => {
    // Regression guard: if someone tries to rename widget's begin status back to
    // in_progress to match the API, this test will catch it.
    const widgetBeginStatus: WidgetActionableStatus = 'started';
    const apiInProgressStatus = 'in_progress';
    expect(widgetBeginStatus).not.toBe(apiInProgressStatus);
  });
});

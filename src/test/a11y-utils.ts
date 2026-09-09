/**
 * Shared accessibility assertion for the widget's component tests.
 *
 * `assertNoA11yViolations` runs axe over a rendered container and collapses every violation into one
 * thrown error naming the rule and its node count, so a failing test reports the blast radius instead
 * of dumping the whole axe result. The `color-contrast` rule is disabled because jsdom has no canvas
 * to measure contrast with.
 */
import { axe } from 'vitest-axe';

export async function assertNoA11yViolations(container: Element): Promise<void> {
  const results = await axe(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  const violations = results.violations ?? [];
  if (violations.length > 0) {
    const messages = violations.map(v => `${v.id}: ${v.help} – ${v.nodes.length} node(s)`);
    throw new Error(`A11y violations:\n${messages.join('\n')}`);
  }
}

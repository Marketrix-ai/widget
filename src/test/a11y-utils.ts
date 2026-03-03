import { axe } from 'vitest-axe';

/**
 * Run axe-core on a container and assert no a11y violations.
 * Use in tests: await assertNoA11yViolations(container);
 * Color-contrast is disabled in jsdom (no canvas).
 */
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

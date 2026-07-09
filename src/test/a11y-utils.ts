import { axe } from 'vitest-axe';

// color-contrast is disabled: jsdom has no canvas to measure it.
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

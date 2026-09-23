/**
 * Shared accessibility assertion for the widget's component tests.
 * `assertNoA11yViolations` runs axe-core over a rendered container and throws one error naming each
 * violated rule and its node count. `color-contrast` is disabled because jsdom has no canvas.
 */
import axeCore from 'axe-core';

export async function assertNoA11yViolations(container: Element): Promise<void> {
  const results = await axeCore.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  const violations = results.violations ?? [];
  if (violations.length > 0) {
    const messages = violations.map(v => `${v.id}: ${v.help} – ${v.nodes.length} node(s)`);
    throw new Error(`A11y violations:\n${messages.join('\n')}`);
  }
}

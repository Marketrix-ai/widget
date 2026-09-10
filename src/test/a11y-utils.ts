/**
 * Shared accessibility assertion for the widget's component tests.
 *
 * `assertNoA11yViolations` runs axe over a rendered container and collapses every violation into one
 * thrown error naming the rule and its node count, so a failing test reports the blast radius instead
 * of dumping the whole axe result. The `color-contrast` rule is disabled because jsdom has no canvas
 * to measure contrast with. `vitest-axe` is dropped for bun (it exists only to wrap this exact
 * `axe-core#run` call in a promise, which axe-core's own API already returns) — this calls axe-core
 * directly rather than reintroducing a vitest-specific dependency.
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

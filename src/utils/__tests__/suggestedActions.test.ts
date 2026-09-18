/**
 * Suggested-action prefixing tests: the mode caption prefixes without editing the tenant text (never
 * eating letters from a word that merely begins with the mode word, collapsing a prefix already
 * written), the dispatched value carries the same prefix as the label, and a tell chip is untouched.
 */
import { describe, expect, it } from 'bun:test';

import { getMockWidgetConfig } from '../../test/fixtures';
import { getSuggestedActionsFromConfig } from '../suggestedActions';

const captionsFor = (mode: 'show' | 'do', texts: string[]) =>
  getSuggestedActionsFromConfig(
    getMockWidgetConfig({ widget_chips: texts.map(chip_text => ({ chip_mode: mode, chip_text })) }),
  ).map(action => action.text);

describe('a suggested-action caption prefixes without editing the tenant text', () => {
  it('never eats letters from a word that merely begins with the mode word', () => {
    expect(captionsFor('do', ['Download the report', 'Document my order', "Don't charge me"])).toEqual([
      'Do Download the report',
      'Do Document my order',
      "Do Don't charge me",
    ]);
    expect(captionsFor('show', ['Show mercy settings'])).toEqual(['Show me Show mercy settings']);
  });

  it('still collapses a prefix the author already wrote', () => {
    expect(captionsFor('do', ['Do reset my password'])).toEqual(['Do reset my password']);
    expect(captionsFor('show', ['Show me the invoice'])).toEqual(['Show me the invoice']);
  });
});

describe('a suggested-action dispatch text matches its caption', () => {
  it.each([
    [
      'carries the prefix into the value MessengerShell dispatches, not just the button label',
      'show',
      'Walk me through checkout',
      'Show me Walk me through checkout',
    ],
    ['leaves a tell chip untouched', 'tell', 'What does conversion rate mean?', 'What does conversion rate mean?'],
  ] as const)('%s', (_case, chip_mode, chip_text, expectedText) => {
    const [action] = getSuggestedActionsFromConfig(getMockWidgetConfig({ widget_chips: [{ chip_mode, chip_text }] }));
    if (!action) throw new Error('expected a suggested action');
    expect(action.text).toBe(expectedText);
  });
});

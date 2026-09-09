/**
 * Suggested-action prefixing tests: the mode caption prefixes without editing the tenant text (never
 * eating letters from a word that merely begins with the mode word, collapsing a prefix already
 * written), the dispatched value carries the same prefix as the label, and a tell chip is untouched.
 */
import { describe, expect, it } from 'vitest';

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
  it('carries the prefix into the value MessengerShell dispatches, not just the button label', () => {
    const [action] = getSuggestedActionsFromConfig(
      getMockWidgetConfig({ widget_chips: [{ chip_mode: 'show', chip_text: 'Walk me through checkout' }] }),
    );
    expect(action.text).toBe('Show me Walk me through checkout');
  });

  it('leaves a tell chip untouched', () => {
    const [action] = getSuggestedActionsFromConfig(
      getMockWidgetConfig({ widget_chips: [{ chip_mode: 'tell', chip_text: 'What does conversion rate mean?' }] }),
    );
    expect(action.text).toBe('What does conversion rate mean?');
  });
});

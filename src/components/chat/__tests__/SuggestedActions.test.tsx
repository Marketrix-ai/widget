import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SuggestedActions } from '../SuggestedActions';

vi.mock('../../../hooks/useWidget', () => ({
  useWidgetConfig: () => ({ widget_text_color: '#000', widget_color: '#fff' }),
}));

const captionsFor = (type: 'show' | 'do', texts: string[]) => {
  const { unmount } = render(
    <SuggestedActions
      actions={texts.map((text, index) => ({ id: String(index), type, text }))}
      onActionClick={async () => {}}
    />,
  );
  const captions = screen.getAllByRole('button').map(button => button.textContent?.trim() ?? '');
  unmount();
  return captions;
};

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

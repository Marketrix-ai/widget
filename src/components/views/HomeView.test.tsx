/**
 * `HomeView` renders each suggested-action chip caption verbatim — a `show`/`do` caption is already
 * prefixed by `getSuggestedActionsFromConfig`, so prefixing again in the view would double it.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { openWidget, renderWidget } from '@/test/renderWidget';

const openHome = (chips: Array<{ chip_text: string; chip_mode: 'tell' | 'show' | 'do' }>) => {
  renderWidget({ widget_chips: chips });
  openWidget();
};

describe('HomeView suggested actions', () => {
  it('renders each caption verbatim, prefixing nothing itself', () => {
    openHome([
      { chip_text: 'What does my conversion rate mean?', chip_mode: 'tell' },
      { chip_text: 'how to add a new product', chip_mode: 'show' },
    ]);

    expect(screen.getByRole('button', { name: 'What does my conversion rate mean?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show me how to add a new product' })).toBeInTheDocument();
  });
});

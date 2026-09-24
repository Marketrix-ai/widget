/**
 * `HomeView` renders each suggested-action chip caption verbatim — a `show`/`do` caption is already
 * prefixed by `getSuggestedActionsFromConfig`, so prefixing again in the view would double it; a chip whose
 * mode the tenant disabled is not offered.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { openWidget, renderWidget } from '../../../test/renderWidget';

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

describe('a chip whose mode the tenant disabled', () => {
  it('is not offered at all', () => {
    renderWidget({
      widget_feature_do: false,
      widget_chips: [
        { chip_text: 'the login flow for me', chip_mode: 'do' },
        { chip_text: 'how to log in', chip_mode: 'show' },
      ],
    });
    openWidget();

    expect(screen.queryByRole('button', { name: 'Do the login flow for me' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show me how to log in' })).toBeInTheDocument();
  });
});

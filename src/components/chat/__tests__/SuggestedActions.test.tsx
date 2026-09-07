import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SuggestedActions } from '../SuggestedActions';

vi.mock('../../../hooks/useWidget', () => ({
  useWidgetConfig: () => ({ widget_text_color: '#000', widget_color: '#fff' }),
}));

describe('SuggestedActions', () => {
  it('renders each action caption verbatim — prefixing is the config layer’s job', () => {
    render(
      <SuggestedActions
        actions={[{ id: '0', type: 'show', text: 'Show me how to add a new product' }]}
        onActionClick={async () => {}}
      />,
    );

    expect(screen.getByRole('button')).toHaveTextContent('Show me how to add a new product');
  });
});

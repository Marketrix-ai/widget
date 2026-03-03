/**
 * Smoke tests: widget and script-tag embed parity (plan Phase 5, 7.7).
 * Ensures the widget mounts and key surfaces are present.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';

import { WidgetProvider } from '../../context/WidgetContext';
import { getMockWidgetConfig } from '../../test/fixtures';
import { MarketrixWidget } from '../MarketrixWidget';

describe('Widget smoke', () => {
  it('mounts and shows launcher button', () => {
    const config = getMockWidgetConfig();
    render(
      <WidgetProvider previewMode>
        <MarketrixWidget config={config} />
      </WidgetProvider>,
    );
    expect(screen.getByRole('button', { name: /open marketrix support chat/i })).toBeInTheDocument();
  });

  it('uses semantic tokens and layer tokens', () => {
    const config = getMockWidgetConfig({ widget_accent_color: '#2563eb' });
    const { container } = render(
      <WidgetProvider previewMode>
        <MarketrixWidget config={config} />
      </WidgetProvider>,
    );
    const widget = container.querySelector('.marketrix-widget');
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveStyle({ '--mx-color-accent': '#2563eb' });
  });
});

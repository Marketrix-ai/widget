import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { WidgetProviders } from '../../context/WidgetProviders';
import { getMockWidgetConfig } from '../../test/fixtures';
import { MarketrixWidget } from '../MarketrixWidget';

describe('Widget smoke', () => {
  it('mounts and shows launcher button', () => {
    const config = getMockWidgetConfig();
    render(
      <WidgetProviders previewMode>
        <MarketrixWidget config={config} />
      </WidgetProviders>,
    );
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('uses semantic tokens and layer tokens', () => {
    const config = getMockWidgetConfig({ widget_accent_color: '#2563eb' });
    const { container } = render(
      <WidgetProviders previewMode>
        <MarketrixWidget config={config} />
      </WidgetProviders>,
    );
    const widget = container.querySelector('[data-marketrix-widget]');
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveStyle({ '--primary': '#2563eb' });
  });

  it('portals the modal inside the token-bearing widget root', async () => {
    const { container } = render(
      <WidgetProviders previewMode>
        <MarketrixWidget config={getMockWidgetConfig()} />
      </WidgetProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start screen sharing' }));

    const dialog = await screen.findByRole('dialog');
    const widgetRoot = container.querySelector('[data-marketrix-widget]');
    expect(widgetRoot).toHaveStyle({ '--primary': '#3b82f6' });
    expect(widgetRoot?.contains(dialog)).toBe(true);
  });

  it('keeps a hidden widget visible in preview mode', () => {
    render(
      <WidgetProviders previewMode>
        <MarketrixWidget config={getMockWidgetConfig({ widget_appearance: 'hidden' })} />
      </WidgetProviders>,
    );
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });
});

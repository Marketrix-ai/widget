import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { WidgetProviders } from '../../context/WidgetProviders';
import { getMockWidgetConfig } from '../../test/fixtures';
import type { MarketrixConfig } from '../../types';
import { WidgetRoot } from '../WidgetRoot';

describe('a config the settings schema refuses', () => {
  it('names the fields that failed instead of rendering nothing and saying nothing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const config = { ...getMockWidgetConfig(), widget_position: 'middle' } as MarketrixConfig;

    const { container } = render(
      <WidgetProviders previewMode>
        <WidgetRoot config={config} />
      </WidgetProviders>,
    );

    expect(container.querySelector('[data-marketrix-widget]')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('widget_position'));
    consoleError.mockRestore();
  });
});

describe('Widget smoke', () => {
  it('mounts and shows launcher button', () => {
    const config = getMockWidgetConfig();
    render(
      <WidgetProviders previewMode>
        <WidgetRoot config={config} />
      </WidgetProviders>,
    );
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('uses semantic tokens and layer tokens', () => {
    const config = getMockWidgetConfig({ widget_accent_color: '#2563eb' });
    const { container } = render(
      <WidgetProviders previewMode>
        <WidgetRoot config={config} />
      </WidgetProviders>,
    );
    const widget = container.querySelector('[data-marketrix-widget]');
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveStyle({ '--primary': '#2563eb' });
  });

  it('portals the modal inside the token-bearing widget root', async () => {
    const { container } = render(
      <WidgetProviders previewMode>
        <WidgetRoot config={getMockWidgetConfig()} />
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

  it('paints the modal above the panel it is portalled beside', async () => {
    render(
      <WidgetProviders previewMode>
        <WidgetRoot config={getMockWidgetConfig()} />
      </WidgetProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    const panel = screen.getByRole('tab', { name: 'Chat' }).closest<HTMLElement>('[style*="z-index"]');
    fireEvent.click(screen.getByRole('button', { name: 'Start screen sharing' }));

    const dialog = await screen.findByRole('dialog');
    expect(Number(dialog.style.zIndex)).toBeGreaterThan(Number(panel?.style.zIndex));
  });

  it('keeps a hidden widget visible in preview mode', () => {
    render(
      <WidgetProviders previewMode>
        <WidgetRoot config={getMockWidgetConfig({ widget_appearance: 'hidden' })} />
      </WidgetProviders>,
    );
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });
});

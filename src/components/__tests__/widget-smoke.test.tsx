/**
 * Widget smoke: it mounts with the launcher, uses semantic and layer tokens, portals the modal inside
 * the token-bearing widget root, paints it above the panel, and keeps a hidden widget visible in
 * preview mode.
 */
import { fireEvent, screen } from '@testing-library/react';

import { openChatTab, openWidget, renderWidget } from '../../test/renderWidget';

describe('Widget smoke', () => {
  it('mounts and shows launcher button', () => {
    renderWidget();
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('uses semantic tokens and layer tokens', () => {
    const { container } = renderWidget({ widget_accent_color: '#2563eb' });
    const widget = container.querySelector('[data-marketrix-widget]');
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveStyle({ '--primary': '#2563eb' });
  });

  it('portals the modal inside the token-bearing widget root', async () => {
    const { container } = renderWidget();

    openWidget();
    openChatTab();
    fireEvent.click(screen.getByRole('button', { name: 'Start screen sharing' }));

    const dialog = await screen.findByRole('dialog');
    const widgetRoot = container.querySelector('[data-marketrix-widget]');
    expect(widgetRoot).toHaveStyle({ '--primary': '#3b82f6' });
    expect(widgetRoot?.contains(dialog)).toBe(true);
  });

  it('paints the modal above the panel it is portalled beside', async () => {
    renderWidget();

    openWidget();
    openChatTab();
    const panel = screen.getByRole('tab', { name: 'Chat' }).closest<HTMLElement>('[style*="z-index"]');
    fireEvent.click(screen.getByRole('button', { name: 'Start screen sharing' }));

    const dialog = await screen.findByRole('dialog');
    expect(Number(dialog.style.zIndex)).toBeGreaterThan(Number(panel?.style.zIndex));
  });

  it('keeps a hidden widget visible in preview mode', () => {
    renderWidget({ widget_appearance: 'hidden' });
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });
});

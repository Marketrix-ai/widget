/**
 * Widget smoke: it mounts with the launcher, uses semantic and layer tokens, portals the modal inside
 * the token-bearing widget root, paints it above the panel, keeps a hidden widget visible in preview mode,
 * and times the greeting out even while the root keeps re-rendering.
 */
import { act, fireEvent, screen } from '@testing-library/react';

import { WidgetProviders } from '../../context/WidgetProviders';
import * as chatThread from '../../services/chatThread';
import { streamClient } from '../../services/StreamClient';
import { getMockWidgetConfig } from '../../test/fixtures';
import { openChatTab, openWidget, renderWidget } from '../../test/renderWidget';
import { WidgetRoot } from '../WidgetRoot';

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

  it('times the greeting out even while the root keeps re-rendering', async () => {
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-greeting');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.useFakeTimers();
    const config = getMockWidgetConfig({ isPreviewMode: false, widget_greeting: 'Hello there' });
    const tree = () => (
      <WidgetProviders config={config}>
        <WidgetRoot />
      </WidgetProviders>
    );
    const { rerender } = renderWidget({ isPreviewMode: false, widget_greeting: 'Hello there' });
    rerender(tree());
    await act(async () => vi.advanceTimersByTime(2000));
    expect(screen.queryAllByText('Hello there')).not.toHaveLength(0);

    for (let i = 0; i < 9; i++) {
      rerender(tree());
      await act(async () => vi.advanceTimersByTime(1000));
    }

    expect(screen.queryAllByText('Hello there')).toHaveLength(0);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});

/**
 * Widget smoke: it mounts with the launcher, uses semantic and layer tokens, portals the modal inside
 * the token-bearing widget root, paints it above the panel, keeps a hidden widget visible in preview mode,
 * waves at the launcher once it settles even while the root keeps re-rendering, and locks mobile page scroll only for a
 * visible open panel.
 */
import { act, fireEvent, screen } from '@testing-library/react';

import { WidgetProviders } from '../../context/WidgetProviders';
import * as chatThread from '../../services/chatThread';
import { readChatSnapshot, writeChatSnapshot } from '../../services/StorageService';
import { streamClient } from '../../services/StreamClient';
import { mockMount, openChatTab, openWidget, renderWidget } from '../../test/renderWidget';
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

  it.each([
    [true, 1],
    [false, 0],
  ] as const)('with the greeting on %p, the launcher waves %p times even while re-rendering', async (on, count) => {
    vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-wave');
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    vi.useFakeTimers();
    const mount = mockMount(false, { widget_greeting_toast: on });
    const tree = () => (
      <WidgetProviders {...mount}>
        <WidgetRoot />
      </WidgetProviders>
    );
    const { rerender } = renderWidget({ widget_greeting_toast: on }, { previewMode: false });
    for (let i = 0; i < 4; i++) {
      rerender(tree());
      await act(async () => vi.advanceTimersByTime(500));
    }

    expect(screen.queryAllByTestId('launcher-wave')).toHaveLength(count);
    expect(screen.queryAllByText('Hey There!')).toHaveLength(0);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    ['default', 'hidden'],
    ['hidden', ''],
  ] as const)(
    'a restored open panel with appearance %p sets mobile page overflow to %p',
    async (appearance, overflow) => {
      vi.spyOn(chatThread, 'getOrCreateChatId').mockResolvedValue('chat-scroll');
      vi.spyOn(streamClient, 'connect').mockResolvedValue();
      vi.spyOn(window, 'matchMedia').mockReturnValue({ ...window.matchMedia(''), matches: true });
      writeChatSnapshot({ ...readChatSnapshot(), isOpen: true });

      const { unmount } = renderWidget({ widget_appearance: appearance }, { previewMode: false });
      await act(async () => {});

      expect(document.body.style.overflow).toBe(overflow);
      unmount();
      writeChatSnapshot({ ...readChatSnapshot(), isOpen: false });
      vi.restoreAllMocks();
    },
  );
});

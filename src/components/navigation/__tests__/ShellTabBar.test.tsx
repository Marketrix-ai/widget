/**
 * Tests for `ShellTabBar`'s Home/Chat tab strip: selection is exposed only via `aria-selected`, both
 * tabs render their underline element, and clicking a tab reports the change.
 */
import { Tabs } from '@base-ui/react/tabs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'bun:test';

import { ShellTabBar } from '../ShellTabBar';

const renderTabs = (value: 'home' | 'chat', onValueChange = vi.fn()) =>
  render(
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <ShellTabBar />
    </Tabs.Root>,
  );

describe('ShellTabBar', () => {
  it('exposes selection as aria-selected, which is what index.css styles on', () => {
    renderTabs('home');

    const home = screen.getByRole('tab', { name: /home/i });
    const chat = screen.getByRole('tab', { name: /chat/i });

    expect(home).toHaveAttribute('aria-selected', 'true');
    expect(chat).toHaveAttribute('aria-selected', 'false');
    expect(home).not.toHaveAttribute('data-selected');
  });

  it('renders the underline in both tabs and lets CSS reveal the selected one', () => {
    const { container } = renderTabs('chat');
    expect(container.querySelectorAll('.mtx-tab-underline')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /chat/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('reports the tab the user picks', () => {
    const onValueChange = vi.fn();
    renderTabs('home', onValueChange);

    fireEvent.click(screen.getByRole('tab', { name: /chat/i }));
    expect(onValueChange).toHaveBeenCalledWith('chat', expect.anything());
  });
});

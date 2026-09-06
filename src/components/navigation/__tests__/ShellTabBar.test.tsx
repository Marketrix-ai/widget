import { Tabs } from '@base-ui/react/tabs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ShellTabBar } from '../ShellTabBar';

const renderTabs = (value: 'home' | 'chat', onValueChange = vi.fn()) =>
  render(
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <ShellTabBar />
    </Tabs.Root>,
  );

describe('ShellTabBar', () => {
  it('exposes selection as aria-selected, which is what index.css styles on', () => {
    // Base UI emits NO `data-selected`, and Tabs.Tab OVERWRITES a `data-active` of its own onto the
    // element — so the active-tab colour, weight and underline all hang off `aria-selected`. If Base
    // UI ever changes that, this fails instead of the tab silently rendering as inactive.
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

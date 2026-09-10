/**
 * Tests for `ShellTabBar`, the Home/Chat tab strip, rendered inside a controlled `Tabs.Root`.
 *
 * `renderTabs` mounts the bar at a given selected value with an optional `onValueChange` spy.
 *
 * The first test pins the selection attribute the styling depends on: Base UI emits NO `data-selected`,
 * and `Tabs.Tab` OVERWRITES any `data-active` of its own onto the element, so index.css hangs the active
 * tab's colour, weight and underline off `aria-selected`. Asserting both the true/false pair and the
 * absence of `data-selected` makes a Base UI change fail here instead of silently rendering every tab
 * inactive. The second pins that the underline element is rendered for BOTH tabs — CSS reveals only the
 * selected one — so a count of two is correct, not a leak. The third pins that a click reports the picked
 * tab through `onValueChange`.
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

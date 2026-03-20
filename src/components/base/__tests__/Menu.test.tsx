import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Menu, MenuContent, MenuItem, MenuTrigger } from '../Menu';

describe('Menu', () => {
  it('renders trigger with correct aria attributes', () => {
    render(
      <Menu>
        <MenuTrigger>Open Menu</MenuTrigger>
        <MenuContent>
          <MenuItem>Option 1</MenuItem>
        </MenuContent>
      </Menu>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Menu' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });

  it('opens menu when trigger is clicked', () => {
    render(
      <Menu>
        <MenuTrigger>Open Menu</MenuTrigger>
        <MenuContent>
          <MenuItem>Option 1</MenuItem>
        </MenuContent>
      </Menu>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }));

    expect(screen.getByRole('menu')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open Menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes menu when MenuItem is clicked', () => {
    render(
      <Menu>
        <MenuTrigger>Open Menu</MenuTrigger>
        <MenuContent>
          <MenuItem>Option 1</MenuItem>
        </MenuContent>
      </Menu>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Option 1' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when menu opens and closes', () => {
    const onOpenChange = vi.fn();

    render(
      <Menu onOpenChange={onOpenChange}>
        <MenuTrigger>Open Menu</MenuTrigger>
        <MenuContent>
          <MenuItem>Option 1</MenuItem>
        </MenuContent>
      </Menu>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Option 1' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports controlled open state', () => {
    render(
      <Menu open>
        <MenuTrigger>Open Menu</MenuTrigger>
        <MenuContent>
          <MenuItem>Option 1</MenuItem>
        </MenuContent>
      </Menu>,
    );

    expect(screen.getByRole('menu')).toBeVisible();
  });

  it('renders menu items with correct role', () => {
    render(
      <Menu defaultOpen>
        <MenuTrigger>Open Menu</MenuTrigger>
        <MenuContent>
          <MenuItem>Option 1</MenuItem>
          <MenuItem>Option 2</MenuItem>
        </MenuContent>
      </Menu>,
    );

    expect(screen.getByRole('menu')).toBeVisible();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });
});

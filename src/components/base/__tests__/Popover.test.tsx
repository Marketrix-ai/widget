import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from '../Popover';

describe('Popover', () => {
  it('renders trigger with correct aria attributes', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Popover' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });

  it('opens popover when trigger is clicked', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Popover' }));

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open Popover' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes popover when trigger is clicked again', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Popover' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeVisible();

    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when popover opens and closes', () => {
    const onOpenChange = vi.fn();

    render(
      <Popover onOpenChange={onOpenChange}>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Popover' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Open Popover' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports controlled open state', () => {
    render(
      <Popover open>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>,
    );

    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('content has correct role and attributes', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>,
    );

    const content = screen.getByRole('dialog');
    expect(content).toHaveAttribute('data-state', 'open');
    expect(content).toHaveAttribute('tabIndex', '-1');
  });
});

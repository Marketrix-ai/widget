import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';

describe('Tooltip', () => {
  it('renders trigger with correct data attributes', () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Hover me' });
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });

  it('shows tooltip on mouse enter', () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Hover me' });
    fireEvent.mouseEnter(trigger);

    expect(screen.getByRole('tooltip')).toBeVisible();
    expect(trigger).toHaveAttribute('data-state', 'open');
  });

  it('hides tooltip on mouse leave', () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Hover me' });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toBeVisible();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus', () => {
    render(
      <Tooltip>
        <TooltipTrigger>Focus me</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Focus me' });
    fireEvent.focus(trigger);

    expect(screen.getByRole('tooltip')).toBeVisible();
  });

  it('hides tooltip on blur', () => {
    render(
      <Tooltip>
        <TooltipTrigger>Focus me</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Focus me' });
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeVisible();

    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when tooltip state changes', () => {
    const onOpenChange = vi.fn();

    render(
      <Tooltip onOpenChange={onOpenChange}>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hover me' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    fireEvent.mouseLeave(screen.getByRole('button', { name: 'Hover me' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports controlled open state', () => {
    render(
      <Tooltip open>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>,
    );

    expect(screen.getByRole('tooltip')).toBeVisible();
  });

  it('supports different element types via "as" prop', () => {
    render(
      <Tooltip>
        <TooltipTrigger as='span'>Span trigger</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByText('Span trigger');
    expect(trigger.tagName).toBe('SPAN');
  });
});

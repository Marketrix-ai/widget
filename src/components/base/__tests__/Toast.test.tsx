import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Toast, ToastClose, ToastViewport, useToastState } from '../Toast';

describe('Toast', () => {
  it('renders toast with correct role and aria-live', () => {
    render(<Toast>Operation successful</Toast>);

    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveTextContent('Operation successful');
  });

  it('applies tone via data attribute', () => {
    render(<Toast tone='success'>Success message</Toast>);

    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'success');
  });

  it('defaults to info tone', () => {
    render(<Toast>Info message</Toast>);

    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'info');
  });

  it('ToastClose calls onDismiss when clicked', () => {
    const onDismiss = vi.fn();

    render(
      <Toast onDismiss={onDismiss}>
        <span>Message</span>
        <ToastClose>Dismiss</ToastClose>
      </Toast>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ToastViewport renders children with correct role', () => {
    render(
      <ToastViewport>
        <Toast>Toast 1</Toast>
        <Toast tone='error'>Toast 2</Toast>
      </ToastViewport>,
    );

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(viewport).toBeInTheDocument();
    expect(viewport.querySelectorAll('[role="status"]')).toHaveLength(2);
  });

  it('useToastState manages open state', () => {
    function TestComponent() {
      const { open, setOpen } = useToastState(false);

      return (
        <>
          <button onClick={() => setOpen(true)}>Show Toast</button>
          {open && <Toast onDismiss={() => setOpen(false)}>Toast message</Toast>}
        </>
      );
    }

    render(<TestComponent />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show Toast' }));
    expect(screen.getByRole('status')).toBeVisible();
  });
});

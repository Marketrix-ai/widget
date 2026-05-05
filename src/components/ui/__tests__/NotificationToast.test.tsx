import { fireEvent, render, screen } from '@testing-library/react';

import { NotificationToast } from '../../blocks/NotificationToast';

describe('NotificationToast (error)', () => {
  it('shows error message and calls onDismiss when close is clicked', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<NotificationToast tone='error' title='Something failed' onDismiss={onDismiss} />);
    expect(screen.getByText('Something failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    vi.advanceTimersByTime(300);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

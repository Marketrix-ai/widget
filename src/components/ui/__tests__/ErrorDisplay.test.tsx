import { fireEvent, render, screen } from '@testing-library/react';

import { ErrorDisplay } from '../ErrorDisplay';

describe('ErrorDisplay', () => {
  it('shows error message and calls onClose when close is clicked', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ErrorDisplay error='Something failed' onClose={onClose} />);
    expect(screen.getByText('Something failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

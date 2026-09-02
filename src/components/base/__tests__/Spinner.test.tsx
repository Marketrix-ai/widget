import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from '../Spinner';

describe('Spinner', () => {
  it('renders with role=status', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders the sr-only Loading label', () => {
    render(<Spinner />);
    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('applies size data attribute', () => {
    render(<Spinner size='lg' />);
    expect(screen.getByRole('status')).toHaveAttribute('data-size', 'lg');
  });

  it('defaults to md size', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('data-size', 'md');
  });
});

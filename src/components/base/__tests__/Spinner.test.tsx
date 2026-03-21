import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from '../Spinner';

describe('Spinner', () => {
  it('renders with role=status', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders default sr-only label when no label provided', () => {
    render(<Spinner />);
    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('renders visible label text when label is provided', () => {
    render(<Spinner label='Saving...' />);
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('applies size data attribute', () => {
    render(<Spinner size='lg' />);
    expect(screen.getByRole('status')).toHaveAttribute('data-size', 'lg');
  });

  it('defaults to md size', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('data-size', 'md');
  });

  it('merges className', () => {
    render(<Spinner className='text-blue-500' />);
    expect(screen.getByRole('status').classList.contains('text-blue-500')).toBe(true);
  });
});

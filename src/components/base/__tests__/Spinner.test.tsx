/**
 * `Spinner` tests: `role=status` with the sr-only Loading label, and the ring sized by `size`.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { Spinner } from '../Spinner';

describe('Spinner', () => {
  it('renders the sr-only Loading label inside a role=status', () => {
    render(<Spinner size='sm' />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('sizes the ring', () => {
    render(<Spinner size='lg' />);
    expect(screen.getByRole('status').firstElementChild).toHaveStyle({ width: '24px', height: '24px' });
  });
});

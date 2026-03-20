import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '../Input';

describe('Input', () => {
  it('sets invalid semantics and error description when invalid', () => {
    render(<Input aria-label='Email' errorMessage='Email is required' validationState='invalid' />);

    const input = screen.getByRole('textbox', { name: 'Email' });
    const message = screen.getByText('Email is required');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('data-validation-state', 'invalid');
    expect(input).toHaveAttribute('aria-describedby', message.id);
  });

  it('supports valid state via data attributes', () => {
    render(<Input aria-label='Name' validationState='valid' />);

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('data-validation-state', 'valid');
  });
});

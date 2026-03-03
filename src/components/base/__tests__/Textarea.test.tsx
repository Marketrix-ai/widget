import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea aria-label='Description' />);

    expect(screen.getByRole('textbox', { name: 'Description' })).toBeInTheDocument();
  });

  it('sets invalid semantics and error description when invalid', () => {
    render(<Textarea aria-label='Notes' errorMessage='Notes are required' validationState='invalid' />);

    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    const message = screen.getByText('Notes are required');

    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAttribute('data-validation-state', 'invalid');
    expect(textarea).toHaveAttribute('aria-describedby', message.id);
  });

  it('supports valid state via data attributes', () => {
    render(<Textarea aria-label='Bio' validationState='valid' />);

    expect(screen.getByRole('textbox', { name: 'Bio' })).toHaveAttribute('data-validation-state', 'valid');
  });

  it('defaults to default validation state', () => {
    render(<Textarea aria-label='Comments' />);

    expect(screen.getByRole('textbox', { name: 'Comments' })).toHaveAttribute('data-validation-state', 'default');
  });

  it('supports disabled state', () => {
    render(<Textarea aria-label='Comments' disabled />);

    expect(screen.getByRole('textbox', { name: 'Comments' })).toBeDisabled();
  });

  it('supports placeholder', () => {
    render(<Textarea aria-label='Comments' placeholder='Enter your comments' />);

    expect(screen.getByPlaceholderText('Enter your comments')).toBeInTheDocument();
  });

  it('supports rows attribute', () => {
    render(<Textarea aria-label='Comments' rows={5} />);

    const textarea = screen.getByRole('textbox', { name: 'Comments' });
    expect(textarea).toHaveAttribute('rows', '5');
  });
});

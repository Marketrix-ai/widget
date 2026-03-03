import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Select } from '../Select';

describe('Select', () => {
  it('renders a select element with options', () => {
    render(
      <Select aria-label='Choose option'>
        <option value='a'>Option A</option>
        <option value='b'>Option B</option>
      </Select>,
    );

    const select = screen.getByRole('combobox', { name: 'Choose option' });
    expect(select).toBeInTheDocument();
    expect(select.querySelectorAll('option')).toHaveLength(2);
  });

  it('applies size variant via data attribute', () => {
    render(
      <Select aria-label='Choose option' sizeVariant='lg'>
        <option value='a'>Option A</option>
      </Select>,
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('data-size', 'lg');
  });

  it('defaults to md size variant', () => {
    render(
      <Select aria-label='Choose option'>
        <option value='a'>Option A</option>
      </Select>,
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('data-size', 'md');
  });

  it('supports disabled state', () => {
    render(
      <Select aria-label='Choose option' disabled>
        <option value='a'>Option A</option>
      </Select>,
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('supports value and onChange', () => {
    const handleChange = vi.fn();

    render(
      <Select aria-label='Choose option' onChange={handleChange} value='b'>
        <option value='a'>Option A</option>
        <option value='b'>Option B</option>
      </Select>,
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('b');
  });
});

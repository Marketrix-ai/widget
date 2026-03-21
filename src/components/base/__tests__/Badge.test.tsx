import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders live variant with data-variant attribute', () => {
    const { container } = render(<Badge variant='live'>Live</Badge>);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).toHaveAttribute('data-variant', 'live');
  });

  it('renders live variant with ping animation dot', () => {
    const { container } = render(<Badge variant='live'>Live</Badge>);
    expect(container.querySelector('.animate-ping')).toBeTruthy();
  });

  it('renders status variant with children', () => {
    render(<Badge variant='status'>Active</Badge>);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders status variant with data-variant attribute', () => {
    const { container } = render(<Badge variant='status'>Active</Badge>);
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'status');
  });

  it('renders count variant', () => {
    render(<Badge variant='count'>42</Badge>);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders count variant with data-variant attribute', () => {
    const { container } = render(<Badge variant='count'>5</Badge>);
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'count');
  });

  it('applies color via style', () => {
    const { container } = render(
      <Badge color='#ff0000' variant='status'>
        Red
      </Badge>,
    );
    expect((container.firstElementChild as HTMLElement).style.color).toBe('rgb(255, 0, 0)');
  });

  it('does not render ping dot for non-live variants', () => {
    const { container } = render(<Badge variant='status'>X</Badge>);
    expect(container.querySelector('.animate-ping')).toBeNull();
  });
});

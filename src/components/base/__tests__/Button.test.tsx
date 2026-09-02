import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { assertNoA11yViolations } from '../../../test/a11y-utils';
import { Button } from '../Button';

describe('Button', () => {
  it('has no axe-core a11y violations', async () => {
    const { container } = render(<Button>Accessible</Button>);
    await assertNoA11yViolations(container);
  });

  it('renders variant and size data attributes', () => {
    render(
      <Button size='lg' variant='secondary'>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('data-size', 'lg');
    expect(button).toHaveAttribute('data-variant', 'secondary');
  });

  it('calls click handler when enabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Open</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

/**
 * `Button` tests: no axe-core violations, variant/size data attributes. The click handler is passed
 * straight through to Base UI's native button with no logic of Button's own, so it is not retested here.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { assertNoA11yViolations } from '../../../test/a11y-utils';
import { Button } from '../Button';

describe('Button', () => {
  it('has no axe-core a11y violations', async () => {
    const { container } = render(<Button>Accessible</Button>);
    await assertNoA11yViolations(container);
  });

  it('renders variant and size data attributes', () => {
    render(
      <Button size='md' variant='secondary'>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('data-size', 'md');
    expect(button).toHaveAttribute('data-variant', 'secondary');
  });
});

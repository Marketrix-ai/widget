import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '../Button';

describe('Button visual snapshots', () => {
  it('primary default matches snapshot', () => {
    const { container } = render(<Button variant='primary'>Submit</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('secondary matches snapshot', () => {
    const { container } = render(<Button variant='secondary'>Cancel</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('loading state matches snapshot', () => {
    const { container } = render(<Button loading>Saving</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });
});

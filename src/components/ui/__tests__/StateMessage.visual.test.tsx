import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StateMessage } from '../StateMessage';

/**
 * Visual regression baselines for StateMessage (Phase 1 deliverable).
 */
describe('StateMessage visual snapshots', () => {
  it('loading variant matches snapshot', () => {
    const { container } = render(<StateMessage variant='loading' message='Connecting…' />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('empty variant matches snapshot', () => {
    const { container } = render(<StateMessage variant='empty' message='No messages yet.' />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('error variant with retry matches snapshot', () => {
    const { container } = render(
      <StateMessage variant='error' message='Something went wrong.' actionLabel='Retry' onAction={() => {}} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

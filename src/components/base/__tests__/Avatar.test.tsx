/**
 * `Avatar` tests: its own class is kept beside a caller className.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { $ } from '../../../test/fixtures';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('keeps its own class alongside a caller className', () => {
    const { container } = render(<Avatar alt='x' className='mtx-fab-avatar' src='/a.png' />);
    const img = $('img', container);
    expect(img.classList.contains('mtx-fab-avatar')).toBe(true);
    expect(img.classList.contains('mtx-avatar')).toBe(true);
  });
});

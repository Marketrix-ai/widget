/**
 * `Icon` tests: a plain path fills with currentColor and a stroked path leaves fill to none.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { Icon } from '../Icon';

describe('Icon', () => {
  it.each([
    ['fills a plain path with currentColor when it sets no stroke', 'close', 'currentColor'],
    ['omits fill on a stroked path, leaving the outline to stroke alone', 'home', 'none'],
  ] as const)('%s', (_case, name, expectedFill) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector('path')?.getAttribute('fill')).toBe(expectedFill);
  });
});

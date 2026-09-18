/**
 * `Icon` tests: an SVG sized by `size` (default 16), className merged, null for an unknown name.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { Icon } from '../Icon';

describe('Icon', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Icon name='close' />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('applies size as width and height', () => {
    const { container } = render(<Icon name='close' size={24} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
  });

  it('merges className', () => {
    const { container } = render(<Icon name='close' className='text-red-500' />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('text-red-500')).toBe(true);
  });

  it('defaults size to 16', () => {
    const { container } = render(<Icon name='close' />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('16');
  });

  it('returns null for unknown icon name', () => {
    // @ts-expect-error testing unknown name
    const { container } = render(<Icon name='nonexistent' />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    ['fills a plain path with currentColor when it sets no stroke', 'close', 'currentColor'],
    ['omits fill on a stroked path, leaving the outline to stroke alone', 'home', 'none'],
  ] as const)('%s', (_case, name, expectedFill) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector('path')?.getAttribute('fill')).toBe(expectedFill);
  });
});

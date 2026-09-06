import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('renders an img element', () => {
    const { container } = render(<Avatar alt='User avatar' src='/avatar.png' />);
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('sets src and alt attributes', () => {
    const { container } = render(<Avatar alt='Jane Doe' src='/jane.png' />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('/jane.png');
    expect(img.alt).toBe('Jane Doe');
  });

  it.each([
    ['sm', '20px'],
    ['md', '32px'],
    ['lg', '48px'],
  ] as const)('resolves preset size %s to %s', (size, px) => {
    const { container } = render(<Avatar alt='x' size={size} src='/a.png' />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.width).toBe(px);
    expect(img.style.height).toBe(px);
  });

  it('defaults to the md preset', () => {
    const { container } = render(<Avatar alt='x' src='/a.png' />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.width).toBe('32px');
  });

  it('applies numeric size as inline style', () => {
    const { container } = render(<Avatar alt='x' size={40} src='/a.png' />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.width).toBe('40px');
    expect(img.style.height).toBe('40px');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLImageElement>();
    render(<Avatar ref={ref} alt='x' src='/a.png' />);
    expect(ref.current?.tagName).toBe('IMG');
  });

  it('keeps its own class alongside a caller className', () => {
    const { container } = render(<Avatar alt='x' className='mtx-fab-avatar' src='/a.png' />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.classList.contains('mtx-fab-avatar')).toBe(true);
    expect(img.classList.contains('mtx-avatar')).toBe(true);
  });
});

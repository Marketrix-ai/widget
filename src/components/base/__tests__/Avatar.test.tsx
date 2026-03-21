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

  it('applies preset size class for sm', () => {
    const { container } = render(<Avatar alt='x' size='sm' src='/a.png' />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.classList.contains('w-5')).toBe(true);
    expect(img.classList.contains('h-5')).toBe(true);
  });

  it('applies preset size class for md (default)', () => {
    const { container } = render(<Avatar alt='x' src='/a.png' />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.classList.contains('w-8')).toBe(true);
    expect(img.classList.contains('h-8')).toBe(true);
  });

  it('applies preset size class for lg', () => {
    const { container } = render(<Avatar alt='x' size='lg' src='/a.png' />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.classList.contains('w-12')).toBe(true);
    expect(img.classList.contains('h-12')).toBe(true);
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

  it('merges className', () => {
    const { container } = render(<Avatar alt='x' className='rounded-full' src='/a.png' />);
    expect(container.querySelector('img')?.classList.contains('rounded-full')).toBe(true);
  });
});

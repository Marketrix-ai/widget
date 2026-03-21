import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
});

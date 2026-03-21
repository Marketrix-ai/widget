import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Flex } from '../Flex';
import { Stack } from '../Stack';

describe('Flex', () => {
  it('renders a div with flex class', () => {
    const { container } = render(<Flex>content</Flex>);
    const el = container.firstElementChild;
    expect(el?.tagName).toBe('DIV');
    expect(el?.classList.contains('flex')).toBe(true);
  });

  it('merges className', () => {
    const { container } = render(<Flex className='items-center gap-2'>content</Flex>);
    expect(container.firstElementChild?.classList.contains('items-center')).toBe(true);
  });

  it('supports as prop', () => {
    const { container } = render(<Flex as='nav'>content</Flex>);
    expect(container.firstElementChild?.tagName).toBe('NAV');
  });

  it('passes style prop', () => {
    const { container } = render(<Flex style={{ gap: '10px' }}>content</Flex>);
    expect((container.firstElementChild as HTMLElement)?.style.gap).toBe('10px');
  });
});

describe('Stack', () => {
  it('renders with flex flex-col', () => {
    const { container } = render(<Stack>content</Stack>);
    const el = container.firstElementChild;
    expect(el?.classList.contains('flex')).toBe(true);
    expect(el?.classList.contains('flex-col')).toBe(true);
  });
});

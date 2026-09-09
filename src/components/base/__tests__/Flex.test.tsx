/**
 * `Flex` and `Stack` tests: display flex, className/style/as pass-through, `hidden` winning over its
 * own display, and Stack rendering a column.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Flex } from '../Flex';
import { Stack } from '../Stack';

describe('Flex', () => {
  it('renders a div that is display:flex', () => {
    const { container } = render(<Flex>content</Flex>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.style.display).toBe('flex');
  });

  it('passes className through', () => {
    const { container } = render(<Flex className='mtx-fab-center'>content</Flex>);
    expect(container.firstElementChild?.classList.contains('mtx-fab-center')).toBe(true);
  });

  it('lets hidden win over its own display, which is applied last', () => {
    const { container } = render(<Flex hidden>content</Flex>);
    expect((container.firstElementChild as HTMLElement).style.display).toBe('none');
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
  it('renders a flex column', () => {
    const { container } = render(<Stack>content</Stack>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.display).toBe('flex');
    expect(el.style.flexDirection).toBe('column');
  });
});

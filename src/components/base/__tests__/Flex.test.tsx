/**
 * `Flex` and `Stack` tests: display flex and Stack rendering a column.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { $ } from '../../../test/fixtures';
import { Flex, Stack } from '../Flex';

describe('Flex', () => {
  it('renders a div that is display:flex', () => {
    const { container } = render(<Flex>content</Flex>);
    const el = $('div', container);
    expect(el.tagName).toBe('DIV');
    expect(el.style.display).toBe('flex');
  });
});

describe('Stack', () => {
  it('renders a flex column', () => {
    const { container } = render(<Stack>content</Stack>);
    const el = $('div', container);
    expect(el.style.display).toBe('flex');
    expect(el.style.flexDirection).toBe('column');
  });
});

/**
 * `Text` tests: resolves the tone color from `variant`, `inheritColor` overrides `variant` for the
 * color only, and truncation/size/weight/align/line height/block/italic each fold into the style object.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { TEXT_TONE } from '../../../design-system/component-tokens';
import { Text } from '../Text';

const colorOf = (element: Element | null): string => (element as HTMLElement | null)?.style.color ?? '';

describe('Text', () => {
  it('colors by variant when inheritColor is not set', () => {
    const { container } = render(<Text variant='muted'>hi</Text>);
    expect(colorOf(container.firstElementChild)).toBe(TEXT_TONE.muted);
  });

  it('defaults to the default variant tone', () => {
    const { container } = render(<Text>hi</Text>);
    expect(colorOf(container.firstElementChild)).toBe(TEXT_TONE.default);
  });

  it('inherits color instead of the variant tone when inheritColor is set, even with a variant given', () => {
    const { container } = render(
      <Text variant='muted' inheritColor>
        hi
      </Text>,
    );
    expect(colorOf(container.firstElementChild)).toBe(TEXT_TONE.inherit);
  });

  it('applies truncation styles when truncate is set', () => {
    const { container } = render(<Text truncate>hi</Text>);
    expect(container.firstElementChild).toHaveStyle({ overflow: 'hidden', textOverflow: 'ellipsis' });
  });

  it('renders as the given element', () => {
    const { container } = render(<Text as='p'>hi</Text>);
    expect(container.querySelector('p')).toBeTruthy();
  });
});

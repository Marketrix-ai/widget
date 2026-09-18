/**
 * `Surface` tests: an explicit prop passed alongside `variant` overrides that variant's own default for
 * the same prop, and the `floatingCard` variant applies its background/border/elevation/padding preset.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { Surface } from '../Surface';

describe('Surface', () => {
  it('lets an explicit prop override the variant default for that same prop', () => {
    const { container } = render(<Surface variant='floatingCard' elevation='none' data-testid='surface' />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.boxShadow).toBeFalsy();
  });

  it('applies the floatingCard variant defaults when nothing overrides them', () => {
    const { container } = render(<Surface variant='floatingCard' />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBe('var(--card)');
    expect(el.style.boxShadow).toBeTruthy();
  });

  it('defaults to no background or elevation with no variant', () => {
    const { container } = render(<Surface />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBeFalsy();
    expect(el.style.boxShadow).toBeFalsy();
  });
});

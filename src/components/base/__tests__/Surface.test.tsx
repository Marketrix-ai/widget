/**
 * `Surface` tests: an explicit prop passed alongside `floatingCard` overrides that preset's own default
 * for the same prop, and `floatingCard` applies its background/border/elevation/padding preset.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { SHADOW } from '../../../design-system/component-tokens';
import { Surface } from '../Surface';

describe('Surface', () => {
  it('lets an explicit prop override the floatingCard default for that same prop', () => {
    const { container } = render(<Surface floatingCard elevation='panel' />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.boxShadow).toBe(SHADOW.panel);
  });

  it('applies the floatingCard defaults when nothing overrides them', () => {
    const { container } = render(<Surface floatingCard />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBe('var(--card)');
    expect(el.style.boxShadow).toBeTruthy();
  });

  it('defaults to no background or elevation without floatingCard', () => {
    const { container } = render(<Surface />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBeFalsy();
    expect(el.style.boxShadow).toBeFalsy();
  });
});

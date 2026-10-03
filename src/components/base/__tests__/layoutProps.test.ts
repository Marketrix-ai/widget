/**
 * `splitLayout` tests: every layout prop across every token maps to its style value, empty props give an
 * empty style, and only the non-layout props are returned for the DOM element.
 */
import { describe, expect, it } from 'bun:test';

import { keysOf } from '../../../sdk/contracts/common';
import { type LayoutProps, splitLayout } from '../layoutProps';

const layoutStyle = (props: LayoutProps) => splitLayout(props)[0];

const SPACING_PX = {
  '2xs': '2px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
} as const;

describe('splitLayout style', () => {
  it('returns an empty style for empty props', () => {
    expect(layoutStyle({})).toEqual({});
  });

  it('maps every spacing token to its pixel value for padding', () => {
    for (const token of keysOf(SPACING_PX)) {
      expect(layoutStyle({ padding: token })).toEqual({ padding: SPACING_PX[token] });
    }
  });

  describe('axis padding writes both sides', () => {
    it.each([
      ['paddingX', { paddingLeft: '8px', paddingRight: '8px' }, 'md'],
      ['paddingY', { paddingTop: '6px', paddingBottom: '6px' }, 'sm'],
    ] as const)('%s: writes both sides from one token', (prop, expected, token) => {
      expect(layoutStyle({ [prop]: token })).toEqual(expected);
    });

    it('a specific side wins over the axis it belongs to', () => {
      expect(layoutStyle({ paddingY: 'sm', paddingTop: 'lg' })).toEqual({
        paddingTop: '12px',
        paddingBottom: '6px',
      });
    });
  });

  it('maps every gap token to its pixel value', () => {
    expect(layoutStyle({ gap: 'sm' })).toEqual({ gap: '6px' });
    expect(layoutStyle({ gap: 'lg' })).toEqual({ gap: '12px' });
  });

  it('maps every align token to alignItems', () => {
    const cases = { center: 'center', start: 'flex-start' } as const;
    for (const align of keysOf(cases)) {
      expect(layoutStyle({ align })).toEqual({ alignItems: cases[align] });
    }
  });

  it('maps every justify token to justifyContent', () => {
    const cases = {
      center: 'center',
      between: 'space-between',
      around: 'space-around',
      end: 'flex-end',
    } as const;
    for (const justify of keysOf(cases)) {
      expect(layoutStyle({ justify })).toEqual({ justifyContent: cases[justify] });
    }
  });

  it('flex: grow/shrink booleans emit only on their non-default value', () => {
    expect(layoutStyle({ grow: true })).toEqual({ flex: '1 1 0%' });
    expect(layoutStyle({ grow: false })).toEqual({});
    expect(layoutStyle({ shrink: false })).toEqual({ flexShrink: 0 });
    expect(layoutStyle({ shrink: true })).toEqual({});
  });

  it('position and inset resolve independently', () => {
    expect(layoutStyle({ position: 'relative' })).toEqual({ position: 'relative' });
    expect(layoutStyle({ position: 'fixed' })).toEqual({ position: 'fixed' });
    expect(layoutStyle({ inset: '0' })).toEqual({ inset: '0' });
  });

  it('overflow and sizing props pass through or resolve to their CSS value', () => {
    expect(layoutStyle({ overflow: 'hidden' })).toEqual({ overflow: 'hidden' });
    expect(layoutStyle({ overflowY: 'auto' })).toEqual({ overflowY: 'auto' });
    expect(layoutStyle({ width: 'full' })).toEqual({ width: '100%' });
    expect(layoutStyle({ height: 'full' })).toEqual({ height: '100%' });
    expect(layoutStyle({ minWidth: '0' })).toEqual({ minWidth: 0 });
    expect(layoutStyle({ minHeight: '0' })).toEqual({ minHeight: 0 });
  });

  it('border resolves per side or all sides, emitting nothing when false', () => {
    expect(layoutStyle({ border: true })).toEqual({
      borderColor: 'var(--border)',
      borderStyle: 'solid',
      borderWidth: '1px',
    });
    expect(layoutStyle({ border: false })).toEqual({});
    expect(layoutStyle({ border: 'top' })).toEqual({
      borderColor: 'var(--border)',
      borderStyle: 'solid',
      borderTopWidth: '1px',
    });
    expect(layoutStyle({ border: 'bottom' })).toEqual({
      borderColor: 'var(--border)',
      borderStyle: 'solid',
      borderBottomWidth: '1px',
    });
  });

  it('rounded resolves the theme radius or pill', () => {
    expect(layoutStyle({ rounded: 'lg' })).toEqual({ borderRadius: 'var(--radius)' });
    expect(layoutStyle({ rounded: 'pill' })).toEqual({ borderRadius: 'var(--radius-pill)' });
  });

  it('animate references a keyframe this stylesheet defines', () => {
    expect(layoutStyle({ animate: 'fadeIn' }).animation).toContain('mtx-fade-in');
  });

  it('combines multiple props', () => {
    expect(layoutStyle({ padding: 'md', align: 'center', grow: true })).toEqual({
      padding: '8px',
      alignItems: 'center',
      flex: '1 1 0%',
    });
  });
});

describe('splitLayout rest', () => {
  it('returns only the non-layout props', () => {
    const [, rest] = splitLayout({ padding: 'md', border: true, className: 'my-class', id: 'my-id' });
    expect(rest).toEqual({ className: 'my-class', id: 'my-id' });
  });
});

/**
 * `resolveLayoutStyle` tests: every layout prop across every token maps to its style value and empty
 * props give an empty style; `stripLayoutProps` removes exactly the layout keys.
 */
import { describe, expect, it } from 'bun:test';

import { resolveLayoutStyle, stripLayoutProps } from '../layoutProps';

const SPACING_PX = {
  '2xs': '2px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
} as const;

describe('resolveLayoutStyle', () => {
  it('returns an empty style for empty props', () => {
    expect(resolveLayoutStyle({})).toEqual({});
  });

  it('maps every spacing token to its pixel value for padding', () => {
    for (const [token, px] of Object.entries(SPACING_PX)) {
      expect(resolveLayoutStyle({ padding: token as keyof typeof SPACING_PX })).toEqual({ padding: px });
    }
  });

  describe('axis padding writes both sides', () => {
    it.each([
      ['paddingX', { paddingLeft: '8px', paddingRight: '8px' }, 'md'],
      ['paddingY', { paddingTop: '6px', paddingBottom: '6px' }, 'sm'],
    ] as const)('%s: writes both sides from one token', (prop, expected, token) => {
      expect(resolveLayoutStyle({ [prop]: token })).toEqual(expected);
    });

    it('a specific side wins over the axis it belongs to', () => {
      expect(resolveLayoutStyle({ paddingY: 'sm', paddingTop: 'lg' })).toEqual({
        paddingTop: '12px',
        paddingBottom: '6px',
      });
    });
  });

  it('maps every gap token to its pixel value', () => {
    expect(resolveLayoutStyle({ gap: 'sm' })).toEqual({ gap: '6px' });
    expect(resolveLayoutStyle({ gap: 'lg' })).toEqual({ gap: '12px' });
  });

  it('maps every align token to alignItems', () => {
    const cases = { center: 'center', start: 'flex-start' };
    for (const [align, alignItems] of Object.entries(cases)) {
      expect(resolveLayoutStyle({ align: align as keyof typeof cases })).toEqual({ alignItems });
    }
  });

  it('maps every justify token to justifyContent', () => {
    const cases = {
      center: 'center',
      between: 'space-between',
      around: 'space-around',
      end: 'flex-end',
    };
    for (const [justify, justifyContent] of Object.entries(cases)) {
      expect(resolveLayoutStyle({ justify: justify as keyof typeof cases })).toEqual({ justifyContent });
    }
  });

  it('flex: grow/shrink booleans emit only on their non-default value', () => {
    expect(resolveLayoutStyle({ grow: true })).toEqual({ flex: '1 1 0%' });
    expect(resolveLayoutStyle({ grow: false })).toEqual({});
    expect(resolveLayoutStyle({ shrink: false })).toEqual({ flexShrink: 0 });
    expect(resolveLayoutStyle({ shrink: true })).toEqual({});
  });

  it('position and inset resolve independently', () => {
    expect(resolveLayoutStyle({ position: 'relative' })).toEqual({ position: 'relative' });
    expect(resolveLayoutStyle({ position: 'fixed' })).toEqual({ position: 'fixed' });
    expect(resolveLayoutStyle({ inset: '0' })).toEqual({ inset: '0' });
  });

  it('overflow and sizing props pass through or resolve to their CSS value', () => {
    expect(resolveLayoutStyle({ overflow: 'hidden' })).toEqual({ overflow: 'hidden' });
    expect(resolveLayoutStyle({ overflowY: 'auto' })).toEqual({ overflowY: 'auto' });
    expect(resolveLayoutStyle({ width: 'full' })).toEqual({ width: '100%' });
    expect(resolveLayoutStyle({ height: 'full' })).toEqual({ height: '100%' });
    expect(resolveLayoutStyle({ minWidth: '0' })).toEqual({ minWidth: 0 });
    expect(resolveLayoutStyle({ minHeight: '0' })).toEqual({ minHeight: 0 });
  });

  it('border resolves per side or all sides, emitting nothing when false', () => {
    expect(resolveLayoutStyle({ border: true })).toEqual({
      borderColor: 'var(--border)',
      borderStyle: 'solid',
      borderWidth: '1px',
    });
    expect(resolveLayoutStyle({ border: false })).toEqual({});
    expect(resolveLayoutStyle({ border: 'top' })).toEqual({
      borderColor: 'var(--border)',
      borderStyle: 'solid',
      borderTopWidth: '1px',
    });
    expect(resolveLayoutStyle({ border: 'bottom' })).toEqual({
      borderColor: 'var(--border)',
      borderStyle: 'solid',
      borderBottomWidth: '1px',
    });
  });

  it('rounded resolves the theme radius or pill', () => {
    expect(resolveLayoutStyle({ rounded: 'lg' })).toEqual({ borderRadius: 'var(--radius)' });
    expect(resolveLayoutStyle({ rounded: 'pill' })).toEqual({ borderRadius: 'var(--radius-pill)' });
  });

  it('animate references a keyframe this stylesheet defines', () => {
    expect(resolveLayoutStyle({ animate: 'fadeIn' }).animation).toContain('mtx-fade-in');
  });

  it('combines multiple props', () => {
    expect(resolveLayoutStyle({ padding: 'md', align: 'center', grow: true })).toEqual({
      padding: '8px',
      alignItems: 'center',
      flex: '1 1 0%',
    });
  });
});

describe('stripLayoutProps', () => {
  it('removes all layout keys', () => {
    const input = {
      padding: 'md' as const,
      paddingX: 'sm' as const,
      paddingY: 'lg' as const,
      gap: 'xs' as const,
      align: 'center' as const,
      justify: 'between' as const,
      grow: true,
      shrink: false,
      position: 'absolute' as const,
      inset: '0' as const,
      overflow: 'hidden' as const,
      overflowY: 'auto' as const,
      width: 'full' as const,
      height: 'full' as const,
      minWidth: '0' as const,
      minHeight: '0' as const,
      border: true,
      rounded: 'lg' as const,
      animate: 'fadeIn' as const,
      as: 'div' as const,
      style: { color: 'red' },
    };
    const result = stripLayoutProps(input);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('keeps non-layout keys', () => {
    const input = {
      padding: 'md' as const,
      className: 'my-class',
      id: 'my-id',
      'data-testid': 'test',
    };
    const result = stripLayoutProps(input);
    expect(result).toEqual({ className: 'my-class', id: 'my-id', 'data-testid': 'test' });
  });

  it('does not mutate the original object', () => {
    const input = { padding: 'md' as const, id: 'foo' };
    stripLayoutProps(input);
    expect(input).toEqual({ padding: 'md', id: 'foo' });
  });

  it('handles empty object', () => {
    expect(stripLayoutProps({})).toEqual({});
  });
});

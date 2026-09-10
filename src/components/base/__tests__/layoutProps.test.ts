/**
 * `resolveLayoutStyle` tests: every spacing prop (padding, margin, gap …) across every token maps to
 * its pixel value, empty props give an empty style, and SPACING_SCALE is declared smallest-first so a
 * token name orders the same way as the pixels it emits.
 */
import { describe, expect, it } from 'vitest';

import { resolveLayoutStyle, SPACING_SCALE, stripLayoutProps } from '../layoutProps';

describe('resolveLayoutStyle', () => {
  it('returns an empty style for empty props', () => {
    expect(resolveLayoutStyle({})).toEqual({});
  });

  it('declares SPACING_SCALE smallest-first, so a token name orders the same way as the pixels it emits', () => {
    const steps = Object.values(SPACING_SCALE).map(value => parseFloat(value));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  describe('padding', () => {
    it('padding: none', () => expect(resolveLayoutStyle({ padding: 'none' })).toEqual({ padding: '0' }));
    it('padding: 2xs', () => expect(resolveLayoutStyle({ padding: '2xs' })).toEqual({ padding: '2px' }));
    it('padding: xs', () => expect(resolveLayoutStyle({ padding: 'xs' })).toEqual({ padding: '4px' }));
    it('padding: sm', () => expect(resolveLayoutStyle({ padding: 'sm' })).toEqual({ padding: '6px' }));
    it('padding: md', () => expect(resolveLayoutStyle({ padding: 'md' })).toEqual({ padding: '8px' }));
    it('padding: lg', () => expect(resolveLayoutStyle({ padding: 'lg' })).toEqual({ padding: '12px' }));
    it('padding: xl', () => expect(resolveLayoutStyle({ padding: 'xl' })).toEqual({ padding: '16px' }));
    it('padding: 2xl', () => expect(resolveLayoutStyle({ padding: '2xl' })).toEqual({ padding: '24px' }));
  });

  describe('axis padding writes both sides', () => {
    it('paddingX: md', () =>
      expect(resolveLayoutStyle({ paddingX: 'md' })).toEqual({ paddingLeft: '8px', paddingRight: '8px' }));
    it('paddingY: sm', () =>
      expect(resolveLayoutStyle({ paddingY: 'sm' })).toEqual({ paddingTop: '6px', paddingBottom: '6px' }));

    it('a specific side wins over the axis it belongs to', () => {
      expect(resolveLayoutStyle({ paddingY: 'sm', paddingTop: 'xl' })).toEqual({
        paddingTop: '16px',
        paddingBottom: '6px',
      });
    });
  });

  describe('gap', () => {
    it('gap: sm', () => expect(resolveLayoutStyle({ gap: 'sm' })).toEqual({ gap: '6px' }));
    it('gap: xl', () => expect(resolveLayoutStyle({ gap: 'xl' })).toEqual({ gap: '16px' }));
  });

  describe('align', () => {
    it('align: center', () => expect(resolveLayoutStyle({ align: 'center' })).toEqual({ alignItems: 'center' }));
    it('align: start', () => expect(resolveLayoutStyle({ align: 'start' })).toEqual({ alignItems: 'flex-start' }));
    it('align: end', () => expect(resolveLayoutStyle({ align: 'end' })).toEqual({ alignItems: 'flex-end' }));
    it('align: stretch', () => expect(resolveLayoutStyle({ align: 'stretch' })).toEqual({ alignItems: 'stretch' }));
    it('align: baseline', () => expect(resolveLayoutStyle({ align: 'baseline' })).toEqual({ alignItems: 'baseline' }));
  });

  describe('justify', () => {
    it('justify: center', () =>
      expect(resolveLayoutStyle({ justify: 'center' })).toEqual({ justifyContent: 'center' }));
    it('justify: between', () =>
      expect(resolveLayoutStyle({ justify: 'between' })).toEqual({ justifyContent: 'space-between' }));
    it('justify: around', () =>
      expect(resolveLayoutStyle({ justify: 'around' })).toEqual({ justifyContent: 'space-around' }));
    it('justify: start', () =>
      expect(resolveLayoutStyle({ justify: 'start' })).toEqual({ justifyContent: 'flex-start' }));
    it('justify: end', () => expect(resolveLayoutStyle({ justify: 'end' })).toEqual({ justifyContent: 'flex-end' }));
  });

  describe('flex', () => {
    it('grow: true', () => expect(resolveLayoutStyle({ grow: true })).toEqual({ flex: '1 1 0%' }));
    it('grow: false emits nothing', () => expect(resolveLayoutStyle({ grow: false })).toEqual({}));
    it('shrink: false', () => expect(resolveLayoutStyle({ shrink: false })).toEqual({ flexShrink: 0 }));
    it('shrink: true emits nothing', () => expect(resolveLayoutStyle({ shrink: true })).toEqual({}));
  });

  describe('position', () => {
    it('position: relative', () =>
      expect(resolveLayoutStyle({ position: 'relative' })).toEqual({ position: 'relative' }));
    it('position: fixed', () => expect(resolveLayoutStyle({ position: 'fixed' })).toEqual({ position: 'fixed' }));
    it('inset: 0', () => expect(resolveLayoutStyle({ inset: '0' })).toEqual({ inset: '0' }));
    it('inset: md', () => expect(resolveLayoutStyle({ inset: 'md' })).toEqual({ inset: '8px' }));
  });

  describe('overflow and sizing', () => {
    it('overflow: hidden', () => expect(resolveLayoutStyle({ overflow: 'hidden' })).toEqual({ overflow: 'hidden' }));
    it('overflowY: auto', () => expect(resolveLayoutStyle({ overflowY: 'auto' })).toEqual({ overflowY: 'auto' }));
    it('width: full', () => expect(resolveLayoutStyle({ width: 'full' })).toEqual({ width: '100%' }));
    it('width: auto', () => expect(resolveLayoutStyle({ width: 'auto' })).toEqual({ width: 'auto' }));
    it('height: full', () => expect(resolveLayoutStyle({ height: 'full' })).toEqual({ height: '100%' }));
    it('minWidth: 0', () => expect(resolveLayoutStyle({ minWidth: '0' })).toEqual({ minWidth: 0 }));
    it('minHeight: 0', () => expect(resolveLayoutStyle({ minHeight: '0' })).toEqual({ minHeight: 0 }));
  });

  describe('border', () => {
    it('border: true', () =>
      expect(resolveLayoutStyle({ border: true })).toEqual({
        borderColor: 'var(--border)',
        borderStyle: 'solid',
        borderWidth: '1px',
      }));
    it('border: false emits nothing', () => expect(resolveLayoutStyle({ border: false })).toEqual({}));
    it('border: top', () =>
      expect(resolveLayoutStyle({ border: 'top' })).toEqual({
        borderColor: 'var(--border)',
        borderStyle: 'solid',
        borderTopWidth: '1px',
      }));
    it('border: bottom', () =>
      expect(resolveLayoutStyle({ border: 'bottom' })).toEqual({
        borderColor: 'var(--border)',
        borderStyle: 'solid',
        borderBottomWidth: '1px',
      }));
  });

  describe('rounded', () => {
    it('rounded: true is the theme radius', () =>
      expect(resolveLayoutStyle({ rounded: true })).toEqual({ borderRadius: 'var(--radius)' }));
    it('rounded: lg is the theme radius', () =>
      expect(resolveLayoutStyle({ rounded: 'lg' })).toEqual({ borderRadius: 'var(--radius)' }));
    it('rounded: pill', () => expect(resolveLayoutStyle({ rounded: 'pill' })).toEqual({ borderRadius: '9999px' }));
    it('rounded: none', () => expect(resolveLayoutStyle({ rounded: 'none' })).toEqual({ borderRadius: '0' }));
    it('rounded: false emits nothing', () => expect(resolveLayoutStyle({ rounded: false })).toEqual({}));
  });

  describe('animate references a keyframe this stylesheet defines', () => {
    it('animate: spin', () => expect(resolveLayoutStyle({ animate: 'spin' }).animation).toContain('mtx-spin'));
    it('animate: ping', () => expect(resolveLayoutStyle({ animate: 'ping' }).animation).toContain('mtx-ping'));
    it('animate: pulse', () => expect(resolveLayoutStyle({ animate: 'pulse' }).animation).toContain('mtx-pulse'));
    it('animate: fadeIn', () => expect(resolveLayoutStyle({ animate: 'fadeIn' }).animation).toContain('mtx-fade-in'));
    it('animate: none emits nothing', () => expect(resolveLayoutStyle({ animate: 'none' })).toEqual({}));
  });

  describe('hidden', () => {
    it('hidden: true', () => expect(resolveLayoutStyle({ hidden: true })).toEqual({ display: 'none' }));
    it('hidden: false emits nothing', () => expect(resolveLayoutStyle({ hidden: false })).toEqual({}));
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
      gap: 'none' as const,
      align: 'center' as const,
      justify: 'between' as const,
      grow: true,
      shrink: false,
      position: 'absolute' as const,
      inset: '0' as const,
      overflow: 'hidden' as const,
      overflowY: 'auto' as const,
      width: 'full' as const,
      height: 'auto' as const,
      minWidth: '0' as const,
      minHeight: '0' as const,
      border: true,
      rounded: 'lg' as const,
      animate: 'spin' as const,
      hidden: true,
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

import { describe, expect, it } from 'vitest';

import { resolveLayoutClasses, stripLayoutProps } from '../layoutProps';

describe('resolveLayoutClasses', () => {
  it('returns empty string for empty props', () => {
    expect(resolveLayoutClasses({})).toBe('');
  });

  describe('padding', () => {
    it('padding: none', () => expect(resolveLayoutClasses({ padding: 'none' })).toBe('p-0'));
    it('padding: xs', () => expect(resolveLayoutClasses({ padding: 'xs' })).toBe('p-0.5'));
    it('padding: sm', () => expect(resolveLayoutClasses({ padding: 'sm' })).toBe('p-1.5'));
    it('padding: md', () => expect(resolveLayoutClasses({ padding: 'md' })).toBe('p-2'));
    it('padding: lg', () => expect(resolveLayoutClasses({ padding: 'lg' })).toBe('p-3'));
    it('padding: xl', () => expect(resolveLayoutClasses({ padding: 'xl' })).toBe('p-4'));
    it('padding: 2xl', () => expect(resolveLayoutClasses({ padding: '2xl' })).toBe('p-6'));
  });

  describe('paddingX', () => {
    it('paddingX: md', () => expect(resolveLayoutClasses({ paddingX: 'md' })).toBe('px-2'));
    it('paddingX: lg', () => expect(resolveLayoutClasses({ paddingX: 'lg' })).toBe('px-3'));
  });

  describe('paddingY', () => {
    it('paddingY: sm', () => expect(resolveLayoutClasses({ paddingY: 'sm' })).toBe('py-1.5'));
    it('paddingY: xl', () => expect(resolveLayoutClasses({ paddingY: 'xl' })).toBe('py-4'));
  });

  describe('gap', () => {
    it('gap: sm', () => expect(resolveLayoutClasses({ gap: 'sm' })).toBe('gap-1.5'));
    it('gap: md', () => expect(resolveLayoutClasses({ gap: 'md' })).toBe('gap-2'));
    it('gap: xl', () => expect(resolveLayoutClasses({ gap: 'xl' })).toBe('gap-4'));
  });

  describe('align', () => {
    it('align: center', () => expect(resolveLayoutClasses({ align: 'center' })).toBe('items-center'));
    it('align: start', () => expect(resolveLayoutClasses({ align: 'start' })).toBe('items-start'));
    it('align: end', () => expect(resolveLayoutClasses({ align: 'end' })).toBe('items-end'));
    it('align: stretch', () => expect(resolveLayoutClasses({ align: 'stretch' })).toBe('items-stretch'));
    it('align: baseline', () => expect(resolveLayoutClasses({ align: 'baseline' })).toBe('items-baseline'));
  });

  describe('justify', () => {
    it('justify: center', () => expect(resolveLayoutClasses({ justify: 'center' })).toBe('justify-center'));
    it('justify: between', () => expect(resolveLayoutClasses({ justify: 'between' })).toBe('justify-between'));
    it('justify: start', () => expect(resolveLayoutClasses({ justify: 'start' })).toBe('justify-start'));
    it('justify: end', () => expect(resolveLayoutClasses({ justify: 'end' })).toBe('justify-end'));
    it('justify: around', () => expect(resolveLayoutClasses({ justify: 'around' })).toBe('justify-around'));
  });

  describe('grow', () => {
    it('grow: true', () => expect(resolveLayoutClasses({ grow: true })).toBe('flex-1'));
    it('grow: false produces no class', () => expect(resolveLayoutClasses({ grow: false })).toBe(''));
  });

  describe('shrink', () => {
    it('shrink: false', () => expect(resolveLayoutClasses({ shrink: false })).toBe('flex-shrink-0'));
    it('shrink: true produces no class', () => expect(resolveLayoutClasses({ shrink: true })).toBe(''));
  });

  describe('position', () => {
    it('position: relative', () => expect(resolveLayoutClasses({ position: 'relative' })).toBe('relative'));
    it('position: absolute', () => expect(resolveLayoutClasses({ position: 'absolute' })).toBe('absolute'));
    it('position: fixed', () => expect(resolveLayoutClasses({ position: 'fixed' })).toBe('fixed'));
    it('position: sticky', () => expect(resolveLayoutClasses({ position: 'sticky' })).toBe('sticky'));
  });

  describe('inset', () => {
    it('inset: 0', () => expect(resolveLayoutClasses({ inset: '0' })).toBe('inset-0'));
    it('inset: md', () => expect(resolveLayoutClasses({ inset: 'md' })).toBe('inset-2'));
    it('inset: lg', () => expect(resolveLayoutClasses({ inset: 'lg' })).toBe('inset-3'));
  });

  describe('overflow', () => {
    it('overflow: hidden', () => expect(resolveLayoutClasses({ overflow: 'hidden' })).toBe('overflow-hidden'));
    it('overflow: auto', () => expect(resolveLayoutClasses({ overflow: 'auto' })).toBe('overflow-auto'));
    it('overflow: visible', () => expect(resolveLayoutClasses({ overflow: 'visible' })).toBe('overflow-visible'));
    it('overflow: scroll', () => expect(resolveLayoutClasses({ overflow: 'scroll' })).toBe('overflow-scroll'));
  });

  describe('overflowY', () => {
    it('overflowY: auto', () => expect(resolveLayoutClasses({ overflowY: 'auto' })).toBe('overflow-y-auto'));
    it('overflowY: hidden', () => expect(resolveLayoutClasses({ overflowY: 'hidden' })).toBe('overflow-y-hidden'));
  });

  describe('width', () => {
    it('width: full', () => expect(resolveLayoutClasses({ width: 'full' })).toBe('w-full'));
    it('width: auto', () => expect(resolveLayoutClasses({ width: 'auto' })).toBe('w-auto'));
  });

  describe('height', () => {
    it('height: full', () => expect(resolveLayoutClasses({ height: 'full' })).toBe('h-full'));
    it('height: auto', () => expect(resolveLayoutClasses({ height: 'auto' })).toBe('h-auto'));
  });

  describe('minWidth', () => {
    it('minWidth: 0', () => expect(resolveLayoutClasses({ minWidth: '0' })).toBe('min-w-0'));
  });

  describe('border', () => {
    it('border: true', () => expect(resolveLayoutClasses({ border: true })).toBe('border border-border'));
    it('border: false produces no class', () => expect(resolveLayoutClasses({ border: false })).toBe(''));
    it('border: top', () => expect(resolveLayoutClasses({ border: 'top' })).toBe('border-t border-border'));
    it('border: bottom', () => expect(resolveLayoutClasses({ border: 'bottom' })).toBe('border-b border-border'));
    it('border: left', () => expect(resolveLayoutClasses({ border: 'left' })).toBe('border-l border-border'));
    it('border: right', () => expect(resolveLayoutClasses({ border: 'right' })).toBe('border-r border-border'));
  });

  describe('rounded', () => {
    it('rounded: true', () => expect(resolveLayoutClasses({ rounded: true })).toBe('rounded-[var(--radius)]'));
    it('rounded: false produces no class', () => expect(resolveLayoutClasses({ rounded: false })).toBe(''));
    it('rounded: theme', () => expect(resolveLayoutClasses({ rounded: 'theme' })).toBe('rounded-[var(--radius)]'));
    it('rounded: full', () => expect(resolveLayoutClasses({ rounded: 'full' })).toBe('rounded-full'));
    it('rounded: lg', () => expect(resolveLayoutClasses({ rounded: 'lg' })).toBe('rounded-lg'));
  });

  describe('animate', () => {
    it('animate: spin', () => expect(resolveLayoutClasses({ animate: 'spin' })).toBe('animate-spin'));
    it('animate: ping', () => expect(resolveLayoutClasses({ animate: 'ping' })).toBe('animate-ping'));
    it('animate: pulse', () => expect(resolveLayoutClasses({ animate: 'pulse' })).toBe('animate-pulse'));
    it('animate: fadeIn', () => expect(resolveLayoutClasses({ animate: 'fadeIn' })).toBe('animate-fade-in'));
    it('animate: none produces no class', () => expect(resolveLayoutClasses({ animate: 'none' })).toBe(''));
  });

  describe('hidden', () => {
    it('hidden: true', () => expect(resolveLayoutClasses({ hidden: true })).toBe('hidden'));
    it('hidden: false produces no class', () => expect(resolveLayoutClasses({ hidden: false })).toBe(''));
  });

  it('combines multiple props', () => {
    const result = resolveLayoutClasses({ padding: 'md', align: 'center', grow: true });
    expect(result).toBe('p-2 items-center flex-1');
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

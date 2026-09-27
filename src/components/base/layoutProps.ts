/**
 * Layout vocabulary for the base components: the `LayoutProps` a component accepts, `splitLayout` which
 * turns them into a style object and returns the remaining props for the DOM element, and `withClass` which
 * appends an optional caller class to a component's fixed base class.
 */
import type { CSSProperties } from 'react';

import { RADIUS, type RadiusToken } from '../../design-system/component-tokens';

type SpacingToken = '2xs' | 'xs' | 'sm' | 'md' | 'lg';

const SPACING_SCALE: Record<SpacingToken, string> = {
  '2xs': '2px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
};

const ALIGN = {
  start: 'flex-start',
  center: 'center',
} as const;

const JUSTIFY = {
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
} as const;

export interface LayoutProps {
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  paddingTop?: SpacingToken;
  paddingBottom?: SpacingToken;
  gap?: SpacingToken;

  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  grow?: boolean;
  shrink?: boolean;

  position?: 'relative' | 'absolute' | 'fixed';
  inset?: '0';

  overflow?: 'hidden';
  overflowY?: 'auto';
  width?: 'full';
  height?: 'full';
  minWidth?: '0';
  minHeight?: '0';

  border?: boolean | 'top' | 'bottom';
  rounded?: RadiusToken | undefined;

  animate?: 'fadeIn' | undefined;
}

const BORDER = { borderColor: 'var(--border)', borderStyle: 'solid' } as const;

type LayoutValues = { [K in keyof LayoutProps]-?: NonNullable<LayoutProps[K]> };

const RESOLVE: { [K in keyof LayoutValues]: (value: LayoutValues[K]) => CSSProperties } = {
  padding: v => ({ padding: SPACING_SCALE[v] }),
  paddingX: v => ({ paddingLeft: SPACING_SCALE[v], paddingRight: SPACING_SCALE[v] }),
  paddingY: v => ({ paddingTop: SPACING_SCALE[v], paddingBottom: SPACING_SCALE[v] }),
  paddingTop: v => ({ paddingTop: SPACING_SCALE[v] }),
  paddingBottom: v => ({ paddingBottom: SPACING_SCALE[v] }),
  gap: v => ({ gap: SPACING_SCALE[v] }),
  align: v => ({ alignItems: ALIGN[v] }),
  justify: v => ({ justifyContent: JUSTIFY[v] }),
  grow: v => (v ? { flex: '1 1 0%' } : {}),
  shrink: v => (v ? {} : { flexShrink: 0 }),
  position: position => ({ position }),
  inset: inset => ({ inset }),
  overflow: overflow => ({ overflow }),
  overflowY: overflowY => ({ overflowY }),
  width: () => ({ width: '100%' }),
  height: () => ({ height: '100%' }),
  minWidth: () => ({ minWidth: 0 }),
  minHeight: () => ({ minHeight: 0 }),
  border: v =>
    v === false
      ? {}
      : v === true
        ? { ...BORDER, borderWidth: '1px' }
        : v === 'top'
          ? { ...BORDER, borderTopWidth: '1px' }
          : { ...BORDER, borderBottomWidth: '1px' },
  rounded: v => ({ borderRadius: RADIUS[v] }),
  animate: () => ({ animation: 'mtx-fade-in 0.5s ease-out' }),
};

const isLayoutKey = (key: string): key is keyof LayoutProps => key in RESOLVE;
const LAYOUT_KEYS = Object.keys(RESOLVE).filter(isLayoutKey);
const resolve = <K extends keyof LayoutValues>(key: K, value: LayoutValues[K]) => RESOLVE[key](value);

export function splitLayout<T extends LayoutProps>(props: T): [CSSProperties, Omit<T, keyof LayoutProps>] {
  const style: CSSProperties = {};
  const rest = { ...props };
  for (const key of LAYOUT_KEYS) {
    const value = props[key];
    delete rest[key];
    if (value !== undefined) Object.assign(style, resolve(key, value));
  }
  return [style, rest];
}

export const withClass = (base: string, extra?: string): string => (extra ? `${base} ${extra}` : base);

/**
 * Layout vocabulary shared by the base components: the token props `LayoutProps` accepts,
 * `resolveLayoutStyle` which reduces them to a `CSSProperties` object, and `stripLayoutProps` which
 * removes them from a props bag so the remainder can be spread onto a DOM element. `SPACING_SCALE` is
 * the exported `SpacingToken`→pixel table, declared smallest-first so a token name orders the same way
 * as the pixels it emits (`__tests__/layoutProps.test.ts` pins that); `ALIGN`, `JUSTIFY`, `ANIMATION`
 * and `BORDER_SIDE` are the private lookups for the remaining token families.
 *
 * Layout props resolve to a style object rather than class names: as classes they were interpolated
 * (`p-${token}`), which no scanner could see, so a build-time safelist emitting the whole 8x7 matrix
 * was the only thing keeping them alive and a missing entry failed silently at runtime.
 * `resolveLayoutStyle` emits a property only for a prop set to a non-default value — `grow: false`,
 * `shrink: true`, `border: false`, `rounded: false` and `animate: 'none'` deliberately emit nothing —
 * and its `ANIMATION` values name `mtx-*` keyframes `index.css` must define
 * (`__tests__/stylesheet-contract.test.ts` pins the pairing).
 *
 * `LAYOUT_KEYS` must list every key of `LayoutProps`: `stripLayoutProps` filters by that set, so a
 * layout prop missing from it reaches the DOM as an unknown attribute. `as` and `style` are in it
 * because the consuming component (`Surface`) applies them itself rather than forwarding them.
 */
import type { CSSProperties, ElementType } from 'react';

import { RADIUS, type RadiusToken } from '../../design-system/component-tokens';

export type SpacingToken = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const SPACING_SCALE: Record<SpacingToken, string> = {
  none: '0',
  '2xs': '2px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
};

const ALIGN = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
} as const;

const JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
} as const;

const ANIMATION = {
  spin: 'mtx-spin 1s linear infinite',
  ping: 'mtx-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
  pulse: 'mtx-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  fadeIn: 'mtx-fade-in 0.5s ease-out',
} as const;

const BORDER_SIDE = {
  top: 'borderTopWidth',
  bottom: 'borderBottomWidth',
  left: 'borderLeftWidth',
  right: 'borderRightWidth',
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

  position?: 'relative' | 'absolute' | 'fixed' | 'sticky';
  inset?: SpacingToken | '0';

  overflow?: 'hidden' | 'auto' | 'visible' | 'scroll';
  overflowY?: 'hidden' | 'auto';
  width?: 'full' | 'auto';
  height?: 'full' | 'auto';
  minWidth?: '0';

  border?: boolean | keyof typeof BORDER_SIDE;
  rounded?: boolean | RadiusToken;

  animate?: 'spin' | 'ping' | 'pulse' | 'fadeIn' | 'none';
  hidden?: boolean;

  as?: ElementType;
  style?: CSSProperties;
}

const LAYOUT_KEYS = new Set<keyof LayoutProps>([
  'padding',
  'paddingX',
  'paddingY',
  'paddingTop',
  'paddingBottom',
  'gap',
  'align',
  'justify',
  'grow',
  'shrink',
  'position',
  'inset',
  'overflow',
  'overflowY',
  'width',
  'height',
  'minWidth',
  'border',
  'rounded',
  'animate',
  'hidden',
  'as',
  'style',
]);

export function resolveLayoutStyle(props: LayoutProps): CSSProperties {
  const style: CSSProperties = {};

  if (props.padding !== undefined) style.padding = SPACING_SCALE[props.padding];
  if (props.paddingX !== undefined) {
    style.paddingLeft = SPACING_SCALE[props.paddingX];
    style.paddingRight = SPACING_SCALE[props.paddingX];
  }
  if (props.paddingY !== undefined) {
    style.paddingTop = SPACING_SCALE[props.paddingY];
    style.paddingBottom = SPACING_SCALE[props.paddingY];
  }
  if (props.paddingTop !== undefined) style.paddingTop = SPACING_SCALE[props.paddingTop];
  if (props.paddingBottom !== undefined) style.paddingBottom = SPACING_SCALE[props.paddingBottom];
  if (props.gap !== undefined) style.gap = SPACING_SCALE[props.gap];

  if (props.align !== undefined) style.alignItems = ALIGN[props.align];
  if (props.justify !== undefined) style.justifyContent = JUSTIFY[props.justify];
  if (props.grow === true) style.flex = '1 1 0%';
  if (props.shrink === false) style.flexShrink = 0;

  if (props.position !== undefined) style.position = props.position;
  if (props.inset !== undefined) style.inset = props.inset === '0' ? '0' : SPACING_SCALE[props.inset];

  if (props.overflow !== undefined) style.overflow = props.overflow;
  if (props.overflowY !== undefined) style.overflowY = props.overflowY;
  if (props.width !== undefined) style.width = props.width === 'full' ? '100%' : 'auto';
  if (props.height !== undefined) style.height = props.height === 'full' ? '100%' : 'auto';
  if (props.minWidth === '0') style.minWidth = 0;

  if (props.border !== undefined && props.border !== false) {
    style.borderColor = 'var(--border)';
    style.borderStyle = 'solid';
    if (props.border === true) style.borderWidth = '1px';
    else style[BORDER_SIDE[props.border]] = '1px';
  }

  if (props.rounded !== undefined && props.rounded !== false) {
    if (props.rounded === true) style.borderRadius = RADIUS.lg;
    else style.borderRadius = RADIUS[props.rounded];
  }

  if (props.animate !== undefined && props.animate !== 'none') style.animation = ANIMATION[props.animate];
  if (props.hidden === true) style.display = 'none';

  return style;
}

export function stripLayoutProps<T extends LayoutProps>(props: T): Omit<T, keyof LayoutProps> {
  const result: Record<string, unknown> = {};
  for (const key in props) {
    if (!LAYOUT_KEYS.has(key as keyof LayoutProps)) {
      result[key] = props[key];
    }
  }
  return result as Omit<T, keyof LayoutProps>;
}

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

const BORDER_SIDE = {
  top: 'borderTopWidth',
  bottom: 'borderBottomWidth',
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

  border?: boolean | keyof typeof BORDER_SIDE;
  rounded?: RadiusToken | undefined;

  animate?: 'fadeIn' | undefined;
}

export function splitLayout<T extends LayoutProps>(props: T): [CSSProperties, Omit<T, keyof LayoutProps>] {
  const {
    padding,
    paddingX,
    paddingY,
    paddingTop,
    paddingBottom,
    gap,
    align,
    justify,
    grow,
    shrink,
    position,
    inset,
    overflow,
    overflowY,
    width,
    height,
    minWidth,
    minHeight,
    border,
    rounded,
    animate,
    ...rest
  } = props;
  const style: CSSProperties = {};

  if (padding !== undefined) style.padding = SPACING_SCALE[padding];
  if (paddingX !== undefined) {
    style.paddingLeft = SPACING_SCALE[paddingX];
    style.paddingRight = SPACING_SCALE[paddingX];
  }
  if (paddingY !== undefined) {
    style.paddingTop = SPACING_SCALE[paddingY];
    style.paddingBottom = SPACING_SCALE[paddingY];
  }
  if (paddingTop !== undefined) style.paddingTop = SPACING_SCALE[paddingTop];
  if (paddingBottom !== undefined) style.paddingBottom = SPACING_SCALE[paddingBottom];
  if (gap !== undefined) style.gap = SPACING_SCALE[gap];

  if (align !== undefined) style.alignItems = ALIGN[align];
  if (justify !== undefined) style.justifyContent = JUSTIFY[justify];
  if (grow === true) style.flex = '1 1 0%';
  if (shrink === false) style.flexShrink = 0;

  if (position !== undefined) style.position = position;
  if (inset !== undefined) style.inset = inset;

  if (overflow !== undefined) style.overflow = overflow;
  if (overflowY !== undefined) style.overflowY = overflowY;
  if (width === 'full') style.width = '100%';
  if (height === 'full') style.height = '100%';
  if (minWidth === '0') style.minWidth = 0;
  if (minHeight === '0') style.minHeight = 0;

  if (border !== undefined && border !== false) {
    style.borderColor = 'var(--border)';
    style.borderStyle = 'solid';
    if (border === true) style.borderWidth = '1px';
    else style[BORDER_SIDE[border]] = '1px';
  }

  if (rounded !== undefined) style.borderRadius = RADIUS[rounded];
  if (animate === 'fadeIn') style.animation = 'mtx-fade-in 0.5s ease-out';

  return [style, rest];
}

export const withClass = (base: string, extra?: string): string => (extra ? `${base} ${extra}` : base);

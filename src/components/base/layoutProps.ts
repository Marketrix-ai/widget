/**
 * Layout vocabulary shared by the base components: the `LayoutProps` a component accepts,
 * `resolveLayoutStyle` which turns them into a style object, and `stripLayoutProps` which removes them
 * from a props bag before the rest is spread onto a DOM element.
 *
 * Layout props resolve to inline style rather than class names, since a class-based version needed a
 * build-time safelist that silently dropped anything missing from it.
 * `withClass` appends an optional caller class to a component's fixed base class.
 */
import type { CSSProperties, ElementType } from 'react';

import { RADIUS, type RadiusToken } from '../../design-system/component-tokens';

type SpacingToken = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const SPACING_SCALE: Record<SpacingToken, string> = {
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
  minHeight?: '0';

  border?: boolean | keyof typeof BORDER_SIDE;
  rounded?: boolean | RadiusToken | undefined;

  animate?: 'spin' | 'ping' | 'fadeIn' | 'none' | undefined;
  hidden?: boolean | undefined;

  as?: ElementType;
  style?: CSSProperties | undefined;
}

const LAYOUT_KEYS = {
  padding: true,
  paddingX: true,
  paddingY: true,
  paddingTop: true,
  paddingBottom: true,
  gap: true,
  align: true,
  justify: true,
  grow: true,
  shrink: true,
  position: true,
  inset: true,
  overflow: true,
  overflowY: true,
  width: true,
  height: true,
  minWidth: true,
  minHeight: true,
  border: true,
  rounded: true,
  animate: true,
  hidden: true,
  as: true,
  style: true,
} satisfies Record<keyof LayoutProps, true>;

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
  if (props.minHeight === '0') style.minHeight = 0;

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

const isLayoutKey = (key: string): key is keyof LayoutProps => key in LAYOUT_KEYS;

export function stripLayoutProps<T extends LayoutProps>(props: T): Omit<T, keyof LayoutProps> {
  const result: Record<string, unknown> = {};
  for (const key in props) {
    if (!isLayoutKey(key)) {
      result[key] = props[key];
    }
  }
  return result as Omit<T, keyof LayoutProps>;
}

export const withClass = (base: string, extra?: string): string => (extra ? `${base} ${extra}` : base);

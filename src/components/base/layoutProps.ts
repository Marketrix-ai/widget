import type { CSSProperties, ElementType } from 'react';

import { radiusClasses } from '../../design-system/component-tokens';

export type SpacingToken = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const SPACING_SCALE: Record<SpacingToken, string> = {
  none: '0',
  '2xs': '0.5',
  xs: '1',
  sm: '1.5',
  md: '2',
  lg: '3',
  xl: '4',
  '2xl': '6',
};

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
} as const;

const justifyClasses = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
} as const;

const overflowClasses = {
  hidden: 'overflow-hidden',
  auto: 'overflow-auto',
  visible: 'overflow-visible',
  scroll: 'overflow-scroll',
} as const;

const overflowYClasses = { hidden: 'overflow-y-hidden', auto: 'overflow-y-auto' } as const;
const widthClasses = { full: 'w-full', auto: 'w-auto' } as const;
const heightClasses = { full: 'h-full', auto: 'h-auto' } as const;
const borderSideClasses = { top: 'border-t', bottom: 'border-b', left: 'border-l', right: 'border-r' } as const;

export interface LayoutProps {
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  paddingTop?: SpacingToken;
  paddingBottom?: SpacingToken;
  gap?: SpacingToken;

  align?: keyof typeof alignClasses;
  justify?: keyof typeof justifyClasses;
  grow?: boolean;
  shrink?: boolean;

  position?: 'relative' | 'absolute' | 'fixed' | 'sticky';
  inset?: SpacingToken | '0';

  overflow?: keyof typeof overflowClasses;
  overflowY?: keyof typeof overflowYClasses;
  width?: keyof typeof widthClasses;
  height?: keyof typeof heightClasses;
  minWidth?: '0';

  border?: boolean | keyof typeof borderSideClasses;
  rounded?: boolean | 'none' | 'sm' | 'full' | 'lg' | 'theme' | 'md' | 'xl' | 'pill' | 'circle';

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

export function resolveLayoutClasses(props: LayoutProps): string {
  const classes: string[] = [];

  if (props.padding !== undefined) classes.push(`p-${SPACING_SCALE[props.padding]}`);
  if (props.paddingX !== undefined) classes.push(`px-${SPACING_SCALE[props.paddingX]}`);
  if (props.paddingY !== undefined) classes.push(`py-${SPACING_SCALE[props.paddingY]}`);
  if (props.paddingTop !== undefined) classes.push(`pt-${SPACING_SCALE[props.paddingTop]}`);
  if (props.paddingBottom !== undefined) classes.push(`pb-${SPACING_SCALE[props.paddingBottom]}`);
  if (props.gap !== undefined) classes.push(`gap-${SPACING_SCALE[props.gap]}`);

  if (props.align !== undefined) classes.push(alignClasses[props.align]);
  if (props.justify !== undefined) classes.push(justifyClasses[props.justify]);
  if (props.grow === true) classes.push('flex-1');
  if (props.shrink === false) classes.push('flex-shrink-0');

  if (props.position !== undefined) classes.push(props.position);
  if (props.inset !== undefined) {
    classes.push(props.inset === '0' ? 'inset-0' : `inset-${SPACING_SCALE[props.inset]}`);
  }

  if (props.overflow !== undefined) classes.push(overflowClasses[props.overflow]);
  if (props.overflowY !== undefined) classes.push(overflowYClasses[props.overflowY]);
  if (props.width !== undefined) classes.push(widthClasses[props.width]);
  if (props.height !== undefined) classes.push(heightClasses[props.height]);
  if (props.minWidth === '0') classes.push('min-w-0');

  if (props.border !== undefined && props.border !== false) {
    if (props.border === true) {
      classes.push('border', 'border-border');
    } else {
      classes.push(borderSideClasses[props.border], 'border-border');
    }
  }
  if (props.rounded !== undefined && props.rounded !== false) {
    if (props.rounded === true) {
      classes.push(radiusClasses.theme);
    } else if (props.rounded === 'full') {
      classes.push(radiusClasses.pill);
    } else {
      classes.push(radiusClasses[props.rounded]);
    }
  }

  if (props.animate !== undefined && props.animate !== 'none') {
    const animateMap: Record<string, string> = {
      spin: 'animate-spin',
      ping: 'animate-ping',
      pulse: 'animate-pulse',
      fadeIn: 'animate-fade-in',
    };
    classes.push(animateMap[props.animate]);
  }
  if (props.hidden === true) classes.push('hidden');

  return classes.join(' ');
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

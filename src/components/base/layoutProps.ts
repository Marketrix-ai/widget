import type { CSSProperties, ElementType } from 'react';

import { radiusClasses } from '../../design-system/component-tokens';

export type SpacingToken = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const spacingScale: Record<SpacingToken, string> = {
  none: '0',
  '2xs': '1',
  xs: '0.5',
  sm: '1.5',
  md: '2',
  lg: '3',
  xl: '4',
  '2xl': '6',
};

export interface LayoutProps {
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  paddingTop?: SpacingToken;
  paddingBottom?: SpacingToken;
  gap?: SpacingToken;

  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  grow?: boolean;
  shrink?: boolean;

  position?: 'relative' | 'absolute' | 'fixed' | 'sticky';
  inset?: SpacingToken | '0';

  overflow?: 'hidden' | 'auto' | 'visible' | 'scroll';
  overflowY?: 'hidden' | 'auto';
  width?: 'full' | 'auto';
  height?: 'full' | 'auto';
  minWidth?: '0';

  border?: boolean | 'top' | 'bottom' | 'left' | 'right';
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

  if (props.padding !== undefined) classes.push(`p-${spacingScale[props.padding]}`);
  if (props.paddingX !== undefined) classes.push(`px-${spacingScale[props.paddingX]}`);
  if (props.paddingY !== undefined) classes.push(`py-${spacingScale[props.paddingY]}`);
  if (props.paddingTop !== undefined) classes.push(`pt-${spacingScale[props.paddingTop]}`);
  if (props.paddingBottom !== undefined) classes.push(`pb-${spacingScale[props.paddingBottom]}`);
  if (props.gap !== undefined) classes.push(`gap-${spacingScale[props.gap]}`);

  if (props.align !== undefined) classes.push(`items-${props.align}`);
  if (props.justify !== undefined) classes.push(`justify-${props.justify}`);
  if (props.grow === true) classes.push('flex-1');
  if (props.shrink === false) classes.push('flex-shrink-0');

  if (props.position !== undefined) classes.push(props.position);
  if (props.inset !== undefined) {
    classes.push(props.inset === '0' ? 'inset-0' : `inset-${spacingScale[props.inset]}`);
  }

  if (props.overflow !== undefined) classes.push(`overflow-${props.overflow}`);
  if (props.overflowY !== undefined) classes.push(`overflow-y-${props.overflowY}`);
  if (props.width !== undefined) classes.push(`w-${props.width}`);
  if (props.height !== undefined) classes.push(`h-${props.height}`);
  if (props.minWidth === '0') classes.push('min-w-0');

  if (props.border !== undefined && props.border !== false) {
    if (props.border === true) {
      classes.push('border', 'border-border');
    } else {
      const side = { top: 't', bottom: 'b', left: 'l', right: 'r' }[props.border];
      classes.push(`border-${side}`, 'border-border');
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

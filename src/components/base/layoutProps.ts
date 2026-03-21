import type { CSSProperties, ElementType } from 'react';

import { spacingScale, type SpacingToken } from './tokens';

export interface LayoutProps {
  // Spacing
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  margin?: SpacingToken;
  marginTop?: SpacingToken;
  gap?: SpacingToken;

  // Flex
  align?: 'start' | 'center';
  justify?: 'start' | 'center' | 'end' | 'between';
  grow?: boolean;
  shrink?: boolean;

  // Position
  position?: 'relative' | 'absolute' | 'fixed';
  inset?: '0';

  // Box
  overflow?: 'hidden' | 'auto';
  overflowY?: 'hidden' | 'auto';
  width?: 'full';
  height?: 'full';

  // Decoration
  border?: boolean | 'top' | 'bottom';
  rounded?: boolean | 'full' | 'lg' | 'theme';
  shadow?: boolean;

  // Interaction
  animate?: 'spin' | 'ping' | 'fadeIn';

  // Polymorphism + style
  as?: ElementType;
  style?: CSSProperties;
}

const LAYOUT_KEYS = new Set<keyof LayoutProps>([
  'padding',
  'paddingX',
  'paddingY',
  'margin',
  'marginTop',
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
  'border',
  'rounded',
  'shadow',
  'animate',
  'as',
  'style',
]);

export function resolveLayoutClasses(props: LayoutProps): string {
  const classes: string[] = [];

  // Spacing
  if (props.padding !== undefined) classes.push(`p-${spacingScale[props.padding]}`);
  if (props.paddingX !== undefined) classes.push(`px-${spacingScale[props.paddingX]}`);
  if (props.paddingY !== undefined) classes.push(`py-${spacingScale[props.paddingY]}`);
  if (props.margin !== undefined) classes.push(`m-${spacingScale[props.margin]}`);
  if (props.marginTop !== undefined) classes.push(`mt-${spacingScale[props.marginTop]}`);
  if (props.gap !== undefined) classes.push(`gap-${spacingScale[props.gap]}`);

  // Flex
  if (props.align !== undefined) classes.push(`items-${props.align}`);
  if (props.justify !== undefined) classes.push(`justify-${props.justify}`);
  if (props.grow === true) classes.push('flex-1');
  if (props.shrink === false) classes.push('flex-shrink-0');

  // Position
  if (props.position !== undefined) classes.push(props.position);
  if (props.inset === '0') classes.push('inset-0');

  // Box
  if (props.overflow !== undefined) classes.push(`overflow-${props.overflow}`);
  if (props.overflowY !== undefined) classes.push(`overflow-y-${props.overflowY}`);
  if (props.width !== undefined) classes.push(`w-${props.width}`);
  if (props.height !== undefined) classes.push(`h-${props.height}`);

  // Decoration
  if (props.border !== undefined && props.border !== false) {
    if (props.border === true) {
      classes.push('border', 'border-border');
    } else {
      const side = { top: 't', bottom: 'b' }[props.border];
      classes.push(`border-${side}`, 'border-border');
    }
  }
  if (props.rounded !== undefined && props.rounded !== false) {
    if (props.rounded === true || props.rounded === 'theme') {
      classes.push('rounded-[var(--radius)]');
    } else if (props.rounded === 'full') {
      classes.push('rounded-full');
    } else if (props.rounded === 'lg') {
      classes.push('rounded-lg');
    }
  }
  if (props.shadow === true) {
    classes.push('shadow-[var(--shadow)]');
  }

  // Interaction
  if (props.animate !== undefined) {
    const animateMap: Record<string, string> = {
      spin: 'animate-spin',
      ping: 'animate-ping',
      fadeIn: 'animate-fade-in',
    };
    classes.push(animateMap[props.animate]);
  }

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

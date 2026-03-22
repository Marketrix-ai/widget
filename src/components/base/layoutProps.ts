import type { CSSProperties, ElementType } from 'react';

import { radiusClasses } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';
import { spacingScale, type SpacingToken } from './tokens';

export interface LayoutProps {
  // Spacing
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  paddingTop?: SpacingToken;
  paddingBottom?: SpacingToken;
  margin?: SpacingToken;
  marginX?: SpacingToken;
  marginY?: SpacingToken;
  marginTop?: SpacingToken;
  marginBottom?: SpacingToken;
  gap?: SpacingToken;

  // Flex
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
  grow?: boolean;
  shrink?: boolean;

  // Position
  position?: 'relative' | 'absolute' | 'fixed' | 'sticky';
  inset?: SpacingToken | '0';

  // Box
  overflow?: 'hidden' | 'auto' | 'visible' | 'scroll';
  overflowY?: 'hidden' | 'auto';
  width?: 'full' | 'auto';
  height?: 'full' | 'auto';
  minWidth?: '0';
  minHeight?: '0';

  // Decoration
  border?: boolean | 'top' | 'bottom' | 'left' | 'right';
  rounded?: boolean | 'none' | 'sm' | 'full' | 'lg' | 'theme' | 'md' | 'xl' | 'pill' | 'circle';
  shadow?: boolean | ShadowToken | 'theme';

  // Interaction
  cursor?: 'pointer' | 'default' | 'not-allowed' | 'grab';
  opacity?: 0 | 50 | 80 | 100;
  animate?: 'spin' | 'ping' | 'pulse' | 'fadeIn' | 'none';
  hidden?: boolean;

  // Polymorphism + style
  as?: ElementType;
  style?: CSSProperties;
}

const LAYOUT_KEYS = new Set<keyof LayoutProps>([
  'padding',
  'paddingX',
  'paddingY',
  'paddingTop',
  'paddingBottom',
  'margin',
  'marginX',
  'marginY',
  'marginTop',
  'marginBottom',
  'gap',
  'align',
  'justify',
  'wrap',
  'grow',
  'shrink',
  'position',
  'inset',
  'overflow',
  'overflowY',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'border',
  'rounded',
  'shadow',
  'cursor',
  'opacity',
  'animate',
  'hidden',
  'as',
  'style',
]);

export function resolveLayoutClasses(props: LayoutProps): string {
  const classes: string[] = [];

  // Spacing
  if (props.padding !== undefined) classes.push(`p-${spacingScale[props.padding]}`);
  if (props.paddingX !== undefined) classes.push(`px-${spacingScale[props.paddingX]}`);
  if (props.paddingY !== undefined) classes.push(`py-${spacingScale[props.paddingY]}`);
  if (props.paddingTop !== undefined) classes.push(`pt-${spacingScale[props.paddingTop]}`);
  if (props.paddingBottom !== undefined) classes.push(`pb-${spacingScale[props.paddingBottom]}`);
  if (props.margin !== undefined) classes.push(`m-${spacingScale[props.margin]}`);
  if (props.marginX !== undefined) classes.push(`mx-${spacingScale[props.marginX]}`);
  if (props.marginY !== undefined) classes.push(`my-${spacingScale[props.marginY]}`);
  if (props.marginTop !== undefined) classes.push(`mt-${spacingScale[props.marginTop]}`);
  if (props.marginBottom !== undefined) classes.push(`mb-${spacingScale[props.marginBottom]}`);
  if (props.gap !== undefined) classes.push(`gap-${spacingScale[props.gap]}`);

  // Flex
  if (props.align !== undefined) classes.push(`items-${props.align}`);
  if (props.justify !== undefined) classes.push(`justify-${props.justify}`);
  if (props.wrap === true) classes.push('flex-wrap');
  if (props.grow === true) classes.push('flex-1');
  if (props.shrink === false) classes.push('flex-shrink-0');

  // Position
  if (props.position !== undefined) classes.push(props.position);
  if (props.inset !== undefined) {
    classes.push(props.inset === '0' ? 'inset-0' : `inset-${spacingScale[props.inset]}`);
  }

  // Box
  if (props.overflow !== undefined) classes.push(`overflow-${props.overflow}`);
  if (props.overflowY !== undefined) classes.push(`overflow-y-${props.overflowY}`);
  if (props.width !== undefined) classes.push(`w-${props.width}`);
  if (props.height !== undefined) classes.push(`h-${props.height}`);
  if (props.minWidth === '0') classes.push('min-w-0');
  if (props.minHeight === '0') classes.push('min-h-0');

  // Decoration
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
      const roundedKey = props.rounded === 'lg' ? 'lg' : props.rounded;
      classes.push(radiusClasses[roundedKey]);
    }
  }
  if (props.shadow === true || props.shadow === 'theme') {
    classes.push('shadow-[var(--shadow)]');
  }

  // Interaction
  if (props.cursor !== undefined) classes.push(`cursor-${props.cursor}`);
  if (props.opacity !== undefined) classes.push(`opacity-${props.opacity}`);

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

import { type ElementType, forwardRef } from 'react';

import { cn } from '@/lib/utils';

import {
  type TextLeading,
  textLeadingClasses,
  type TextTone,
  textToneClasses,
} from '../../design-system/component-tokens';

type TextVariant = 'default' | 'muted' | 'faint';
type TextSize = 'xxs' | 'xs' | 'sm' | 'base' | 'lg';
type TextWeight = 'normal' | 'medium' | 'semibold';
type TextAlign = 'center' | 'right';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: ElementType;
  block?: boolean;
  clamp?: 1 | 2 | 3;
  code?: boolean;
  inheritColor?: boolean;
  italic?: boolean;
  leading?: TextLeading;
  tone?: TextTone;
  variant?: TextVariant;
  size?: TextSize;
  weight?: TextWeight;
  truncate?: boolean;
  align?: TextAlign;
  /** @internal blocks/ only */
  className?: string;
}

const sizeStyles: Record<TextSize, string> = {
  xxs: 'text-[10px]',
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

const weightStyles: Record<TextWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
};

const alignStyles: Record<TextAlign, string> = {
  center: 'text-center',
  right: 'text-right',
};

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  {
    as: Component = 'span',
    block = false,
    clamp,
    code = false,
    inheritColor = false,
    italic = false,
    leading,
    tone,
    variant = 'default',
    size,
    weight,
    truncate,
    align,
    className,
    style,
    ...props
  },
  ref,
) {
  const resolvedTone: TextTone = inheritColor
    ? 'inherit'
    : (tone ?? ({ default: 'default', muted: 'muted', faint: 'faint' }[variant] as TextTone));

  return (
    <Component
      {...props}
      ref={ref}
      className={cn(
        textToneClasses[resolvedTone],
        size && sizeStyles[size],
        weight && weightStyles[weight],
        align && alignStyles[align],
        leading && textLeadingClasses[leading],
        block && 'block',
        code && 'font-mono',
        italic && 'italic',
        truncate && 'truncate',
        className,
      )}
      style={
        clamp
          ? {
              ...style,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: clamp,
              overflow: 'hidden',
            }
          : style
      }
    />
  );
});

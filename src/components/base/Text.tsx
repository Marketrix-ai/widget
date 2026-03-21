import { type ElementType, forwardRef } from 'react';

import { cn } from '@/lib/utils';

type TextVariant = 'default' | 'muted' | 'faint' | 'accent';
type TextSize = 'xs' | 'sm' | 'base' | 'lg';
type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';
type TextAlign = 'left' | 'center' | 'right';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: TextVariant;
  size?: TextSize;
  weight?: TextWeight;
  truncate?: boolean;
  align?: TextAlign;
  /** @internal blocks/ only */
  className?: string;
}

const variantStyles: Record<TextVariant, string> = {
  default: 'text-foreground',
  muted: 'text-foreground-muted',
  faint: 'text-foreground-faint',
  accent: 'text-primary',
};

const sizeStyles: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

const weightStyles: Record<TextWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const alignStyles: Record<TextAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { as: Component = 'span', variant = 'default', size, weight, truncate, align, className, ...props },
  ref,
) {
  return (
    <Component
      {...props}
      ref={ref}
      className={cn(
        variantStyles[variant],
        size && sizeStyles[size],
        weight && weightStyles[weight],
        align && alignStyles[align],
        truncate && 'truncate',
        className,
      )}
    />
  );
});

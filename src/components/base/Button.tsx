import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/utils';

import { getElevationStyle, radiusClasses } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'bare' | 'chip' | 'tab' | 'inline' | 'toolbar';
type ButtonSize = 'sm' | 'md';
type ButtonShape = 'default' | 'theme' | 'pill';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  active?: boolean;
  elevation?: ShadowToken;
  loading?: boolean;
  size?: ButtonSize;
  shape?: ButtonShape;
  stacked?: boolean;
  variant?: ButtonVariant;
  full?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80',
  ghost: 'bg-transparent text-foreground border-border hover:bg-muted',
  bare: 'bg-transparent text-inherit border-transparent hover:bg-transparent p-0 min-h-0',
  chip: 'bg-secondary-bg text-foreground border-transparent hover:bg-primary hover:text-primary-foreground hover:border-primary',
  tab: 'bg-transparent text-foreground-muted border-transparent hover:text-foreground hover:bg-transparent p-0 min-h-0',
  inline: 'bg-transparent text-primary border-transparent hover:bg-transparent hover:text-primary p-0 min-h-0',
  toolbar: 'bg-transparent text-foreground border-transparent opacity-60 hover:opacity-100',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs min-h-7',
  md: 'px-4 py-2 text-sm min-h-9',
};

const shapeClasses: Record<ButtonShape, string> = {
  default: 'rounded-lg',
  theme: radiusClasses.theme,
  pill: radiusClasses.pill,
};

export function Button({
  active = false,
  className,
  disabled,
  elevation,
  full,
  loading = false,
  shape = 'default',
  size = 'md',
  stacked = false,
  type = 'button',
  variant = 'primary',
  style,
  ref,
  ...props
}: ButtonProps) {
  const hasChrome = !['bare', 'inline', 'tab', 'toolbar'].includes(variant);
  const isDisabled = disabled || loading;

  return (
    <BaseButton
      {...props}
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        hasChrome && 'border',
        shapeClasses[shape],
        variantStyles[variant],
        variant !== 'bare' && variant !== 'inline' && variant !== 'tab' && sizeStyles[size],
        stacked && 'flex-col gap-0.5',
        variant === 'tab' && 'h-full min-w-0 flex-1',
        active && variant === 'tab' && 'text-primary font-semibold',
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        loading && 'opacity-70 cursor-wait pointer-events-none',
        full && 'w-full',
        className,
      )}
      aria-busy={loading ? 'true' : undefined}
      data-disabled={disabled ? 'true' : 'false'}
      data-loading={loading ? 'true' : 'false'}
      data-size={size}
      data-variant={variant}
      disabled={isDisabled}
      style={{ ...getElevationStyle(elevation), ...style }}
      type={type}
    />
  );
}

import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/utils';

import { getElevationStyle, radiusClasses, type TextTone, textToneClasses } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';

type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'toolbar';
type IconButtonSize = 'xs' | 'sm';
type IconButtonShape = 'circle' | 'theme';

export interface IconButtonProps extends ComponentPropsWithRef<'button'> {
  elevation?: ShadowToken;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: IconButtonShape;
  tone?: TextTone;
  label: string;
  /** @internal blocks/ only */
  className?: string;
}

const variantStyles: Record<IconButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-secondary-bg text-foreground hover:bg-secondary-hover',
  ghost: 'bg-transparent text-foreground opacity-60 hover:opacity-100',
  toolbar: 'bg-transparent text-foreground opacity-60 hover:opacity-100',
};

const sizeStyles: Record<IconButtonSize, string> = {
  xs: 'w-5 h-5 min-w-5',
  sm: 'w-7 h-7 min-w-7',
};

const shapeClasses: Record<IconButtonShape, string> = {
  circle: radiusClasses.circle,
  theme: radiusClasses.theme,
};

export function IconButton({
  variant = 'ghost',
  size = 'sm',
  shape = 'circle',
  tone,
  label,
  disabled,
  elevation,
  className: userClassName,
  children,
  style,
  ref,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      ref={ref}
      type='button'
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center flex-shrink-0 border-none cursor-pointer transition-all',
        shapeClasses[shape],
        variantStyles[variant],
        tone && textToneClasses[tone],
        sizeStyles[size],
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        userClassName,
      )}
      style={{ ...getElevationStyle(elevation), ...style }}
    >
      {children}
    </button>
  );
}

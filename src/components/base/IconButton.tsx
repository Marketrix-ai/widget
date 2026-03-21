import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type IconButtonVariant = 'primary' | 'secondary' | 'ghost';
type IconButtonSize = 'sm';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  label: string;
  /** @internal blocks/ only */
  className?: string;
}

const variantStyles: Record<IconButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-secondary-bg text-foreground hover:bg-secondary-hover',
  ghost: 'bg-transparent text-foreground opacity-60 hover:opacity-100',
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 min-w-7',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'sm', label, disabled, className: userClassName, children, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type='button'
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center flex-shrink-0 border-none cursor-pointer transition-all rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        userClassName,
      )}
    >
      {children}
    </button>
  );
});

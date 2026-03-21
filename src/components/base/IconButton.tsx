import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type IconButtonVariant = 'primary' | 'secondary' | 'ghost';
type IconButtonSize = 'sm' | 'md';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  rounded?: boolean;
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
  md: 'w-9 h-9 min-w-9',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'sm', rounded = true, label, disabled, className: userClassName, children, ...props },
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
        'inline-flex items-center justify-center flex-shrink-0 border-none cursor-pointer transition-all',
        variantStyles[variant],
        sizeStyles[size],
        rounded ? 'rounded-full' : 'rounded-[var(--radius)]',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        userClassName,
      )}
    >
      {children}
    </button>
  );
});

import { Button as BaseButton } from '@base-ui/react/button';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80',
  ghost: 'bg-transparent text-foreground border-border hover:bg-muted',
  danger: 'bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs min-h-7',
  md: 'px-4 py-2 text-sm min-h-9',
  lg: 'px-6 py-3 text-base min-h-11',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, disabled, loading = false, size = 'md', type = 'button', variant = 'primary', ...props },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <BaseButton
      {...props}
      ref={ref}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium border rounded-lg cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && !loading && 'opacity-50 cursor-not-allowed pointer-events-none',
        loading && 'opacity-70 cursor-wait pointer-events-none',
        className,
      )}
      data-disabled={isDisabled ? 'true' : 'false'}
      data-loading={loading ? 'true' : 'false'}
      data-size={size}
      data-variant={variant}
      disabled={isDisabled}
      type={type}
    />
  );
});

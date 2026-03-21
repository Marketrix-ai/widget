import { Button as BaseButton } from '@base-ui/react/button';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
  full?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80',
  ghost: 'bg-transparent text-foreground border-border hover:bg-muted',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs min-h-7',
  md: 'px-4 py-2 text-sm min-h-9',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, disabled, full, size = 'md', type = 'button', variant = 'primary', ...props },
  ref,
) {
  return (
    <BaseButton
      {...props}
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium border rounded-lg cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        variantStyles[variant],
        sizeStyles[size],
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        full && 'w-full',
        className,
      )}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-variant={variant}
      disabled={disabled}
      type={type}
    />
  );
});

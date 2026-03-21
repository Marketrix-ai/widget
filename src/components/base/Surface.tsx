import { type ElementType, forwardRef } from 'react';

import { cn } from '@/lib/utils';

type SurfaceVariant = 'default' | 'card' | 'overlay';
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: SurfaceVariant;
  border?: boolean;
  rounded?: boolean;
  shadow?: boolean;
  padding?: SurfacePadding;
}

const variantStyles: Record<SurfaceVariant, string> = {
  default: 'bg-background',
  card: 'bg-card',
  overlay: 'bg-background/70 backdrop-blur-sm',
};

const paddingStyles: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
};

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  { as: Component = 'div', variant = 'default', border, rounded, shadow, padding = 'none', className, ...props },
  ref,
) {
  return (
    <Component
      {...props}
      ref={ref}
      className={cn(
        variantStyles[variant],
        border && 'border border-border',
        rounded && 'rounded-[var(--radius)]',
        shadow && 'shadow-[var(--shadow)]',
        paddingStyles[padding],
        className,
      )}
    />
  );
});

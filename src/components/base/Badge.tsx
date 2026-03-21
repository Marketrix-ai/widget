import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type BadgeVariant = 'live' | 'status' | 'count';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  color?: string;
  /** @internal blocks/ only */
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  live: 'inline-flex items-center gap-1',
  status: 'inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded',
  count: 'inline-flex items-center justify-center text-[10px] font-semibold min-w-4 h-4 px-1 rounded-full',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant, color, className, style, children, ...props },
  ref,
) {
  return (
    <span
      {...props}
      ref={ref}
      className={cn(variantStyles[variant], className)}
      data-variant={variant}
      style={{ color, ...style }}
    >
      {variant === 'live' && (
        <span className='relative flex h-1.5 w-1.5'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75' />
          <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-current' />
        </span>
      )}
      {children}
    </span>
  );
});

import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

import type { TextTone } from '../../design-system/component-tokens';

type BadgeVariant = 'count' | 'live' | 'status';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string;
  tone?: Extract<TextTone, 'default' | 'muted' | 'primary' | 'success' | 'warning'>;
  variant: BadgeVariant;
  /** @internal blocks/ only */
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  count: 'inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground',
  live: 'inline-flex items-center gap-1',
  status: 'inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded',
};

const toneStyles: NonNullable<BadgeProps['tone']> extends never
  ? never
  : Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'bg-muted text-muted-foreground',
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-chart-1/15 text-chart-1',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant, color, tone = 'default', className, style, children, ...props },
  ref,
) {
  return (
    <span
      {...props}
      ref={ref}
      className={cn(variantStyles[variant], variant === 'status' && toneStyles[tone], className)}
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

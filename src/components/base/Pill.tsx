import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type PillVariant = 'primary' | 'secondary';
type PillSize = 'sm' | 'md';

export interface PillProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  active?: boolean;
  variant?: PillVariant;
  size?: PillSize;
  animated?: boolean;
}

const sizeStyles: Record<PillSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-0.5',
  md: 'px-3 py-1 text-sm gap-1',
};

export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { active = false, variant = 'primary', size = 'sm', animated = false, children, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type='button'
      className={cn(
        'inline-flex items-center font-medium rounded-full border-none cursor-pointer transition-all duration-200',
        sizeStyles[size],
        active && variant === 'primary' && 'bg-primary text-primary-foreground shadow-sm',
        active && variant === 'secondary' && 'bg-secondary text-secondary-foreground shadow-sm',
        !active && 'bg-secondary-bg text-foreground-muted',
        animated && active && 'animate-[glow-border-pulse_2s_ease-in-out_infinite]',
      )}
    >
      {children}
    </button>
  );
});

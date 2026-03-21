import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type PillVariant = 'primary';
type PillSize = 'sm';

export interface PillProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  active?: boolean;
  variant?: PillVariant;
  size?: PillSize;
}

const sizeStyles: Record<PillSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-0.5',
};

export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { active = false, variant = 'primary', size = 'sm', children, ...props },
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
        !active && 'bg-secondary-bg text-foreground-muted',
      )}
    >
      {children}
    </button>
  );
});

import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'h-3.5 w-3.5 border-[1.5px]',
  md: 'h-5 w-5 border-2',
  lg: 'h-6 w-6 border-2',
};

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(function Spinner(
  { size = 'md', label, className },
  ref,
) {
  return (
    <div ref={ref} className={cn('inline-flex items-center gap-1.5', className)} data-size={size} role='status'>
      <div
        aria-hidden='true'
        className={cn('animate-spin rounded-full border-current border-t-transparent flex-shrink-0', sizeStyles[size])}
      />
      {label ? <span className='text-xs'>{label}</span> : <span className='sr-only'>Loading</span>}
    </div>
  );
});

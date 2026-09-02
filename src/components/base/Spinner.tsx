import type { CSSProperties, Ref } from 'react';

import { cn } from '@/lib/utils';

type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'h-3.5 w-3.5 border-[1.5px]',
  md: 'h-5 w-5 border-2',
  lg: 'h-6 w-6 border-2',
};

export function Spinner({ size = 'md', style, ref }: SpinnerProps) {
  return (
    <div ref={ref} className='inline-flex items-center gap-1.5' data-size={size} role='status' style={style}>
      <div
        aria-hidden='true'
        className={cn('animate-spin rounded-full border-current border-t-transparent flex-shrink-0', sizeStyles[size])}
      />
      <span className='sr-only'>Loading</span>
    </div>
  );
}

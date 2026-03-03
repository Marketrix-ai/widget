import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  sizeVariant?: SelectSize;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, sizeVariant = 'md', ...props },
  ref,
) {
  return <select {...props} ref={ref} className={cn('base-select', className)} data-size={sizeVariant} />;
});

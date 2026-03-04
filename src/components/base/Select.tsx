import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  sizeVariant?: SelectSize;
}

const sizeStyles: Record<SelectSize, string> = {
  sm: 'px-2 py-1 text-xs pr-7 bg-[right_8px_center]',
  md: 'px-3 py-2 text-sm pr-9 bg-[right_12px_center]',
  lg: 'px-4 py-3 text-base pr-11 bg-[right_16px_center]',
};

const chevronSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M2.5 4.5L6 8l3.5-3.5'/%3E%3C/svg%3E")`;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, sizeVariant = 'md', ...props },
  ref,
) {
  return (
    <select
      {...props}
      ref={ref}
      className={cn(
        'block w-full leading-normal text-foreground bg-background border border-input rounded-lg cursor-pointer transition-colors appearance-none bg-no-repeat hover:border-muted-foreground focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
        sizeStyles[sizeVariant],
        className,
      )}
      data-size={sizeVariant}
      style={{ backgroundImage: chevronSvg, ...props.style }}
    />
  );
});

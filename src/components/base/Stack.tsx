import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

import type { FlexProps } from './Flex';

export type StackProps = Omit<FlexProps, 'as'>;

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack({ className, ...props }, ref) {
  return <div {...props} ref={ref} className={cn('flex flex-col', className)} />;
});

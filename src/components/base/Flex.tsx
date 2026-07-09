import { forwardRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Surface, type SurfaceProps } from './Surface';

export interface FlexProps extends SurfaceProps {
  direction?: 'row' | 'column';
  children?: ReactNode;
}

export const Flex = forwardRef<HTMLElement, FlexProps>(function Flex(props, ref) {
  const { className, direction, ...rest } = props;
  return <Surface {...rest} ref={ref} className={cn('flex', direction === 'column' && 'flex-col', className)} />;
});

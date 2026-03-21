import { type CSSProperties, type ElementType, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface FlexProps extends React.HTMLAttributes<HTMLElement> {
  as?: ElementType;
  style?: CSSProperties;
}

export const Flex = forwardRef<HTMLElement, FlexProps>(function Flex(
  { as: Component = 'div', className, ...props },
  ref,
) {
  return <Component {...props} ref={ref} className={cn('flex', className)} />;
});

import { forwardRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { type LayoutProps, resolveLayoutClasses, stripLayoutProps } from './layoutProps';

export interface FlexProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'className'> {
  direction?: 'row' | 'column';
  /** @internal blocks/ only */
  className?: string;
  children?: ReactNode;
}

export const Flex = forwardRef<HTMLElement, FlexProps>(function Flex(props, ref) {
  const { as: Component = 'div', direction, className, style, ...rest } = props;
  const layoutClasses = resolveLayoutClasses(props);
  const domProps = stripLayoutProps(rest);

  return (
    <Component
      {...domProps}
      ref={ref}
      className={cn('flex', direction === 'column' && 'flex-col', layoutClasses, className)}
      style={style}
    />
  );
});

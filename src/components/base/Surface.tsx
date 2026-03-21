import { type ElementType, forwardRef } from 'react';

import { cn } from '@/lib/utils';

import { type LayoutProps, resolveLayoutClasses, stripLayoutProps } from './layoutProps';

export interface SurfaceProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'className'> {
  as?: ElementType;
  /** @internal blocks/ only */
  className?: string;
}

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(props, ref) {
  const { as: Component = 'div', className, style, ...rest } = props;
  const layoutClasses = resolveLayoutClasses(props);
  const domProps = stripLayoutProps(rest);

  return <Component {...domProps} ref={ref} className={cn(layoutClasses, className)} style={style} />;
});

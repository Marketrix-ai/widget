import { type ElementType, forwardRef } from 'react';

import { cn } from '@/lib/utils';

import { type LayoutProps, resolveLayoutClasses, stripLayoutProps } from './layoutProps';

type SurfaceVariant = 'default' | 'card' | 'overlay';

export interface SurfaceProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'className'> {
  as?: ElementType;
  variant?: SurfaceVariant;
  /** @internal blocks/ only */
  className?: string;
}

const variantStyles: Record<SurfaceVariant, string> = {
  default: 'bg-background',
  card: 'bg-card',
  overlay: 'bg-background/70 backdrop-blur-sm',
};

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(props, ref) {
  const { as: Component = 'div', variant = 'default', className, style, ...rest } = props;
  const layoutClasses = resolveLayoutClasses(props);
  const domProps = stripLayoutProps(rest);

  return (
    <Component {...domProps} ref={ref} className={cn(variantStyles[variant], layoutClasses, className)} style={style} />
  );
});

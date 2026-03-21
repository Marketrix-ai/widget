import { forwardRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { type LayoutProps, resolveLayoutClasses, stripLayoutProps } from './layoutProps';

export interface StackProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> {
  /** @internal blocks/ only */
  className?: string;
  children?: ReactNode;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(props, ref) {
  const { className, style, ...rest } = props;
  const layoutClasses = resolveLayoutClasses(props);
  const domProps = stripLayoutProps(rest);

  return <div {...domProps} ref={ref} className={cn('flex flex-col', layoutClasses, className)} style={style} />;
});

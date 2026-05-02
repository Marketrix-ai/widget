import { forwardRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Surface, type SurfaceProps } from './Surface';

/**
 * Flex extends Surface with flexbox semantics.
 *
 * Composes `Surface` so that the prop-forwarding, className merging, and
 * elevation/padding/background/radius/layout handling all live in exactly
 * one place. Flex's only contribution is the `flex` utility class plus an
 * optional `flex-col` from the `direction` prop. Public API is unchanged
 * for callers.
 */
export interface FlexProps extends SurfaceProps {
  direction?: 'row' | 'column';
  children?: ReactNode;
}

export const Flex = forwardRef<HTMLElement, FlexProps>(function Flex(props, ref) {
  const { className, direction, ...rest } = props;
  return <Surface {...rest} ref={ref} className={cn('flex', direction === 'column' && 'flex-col', className)} />;
});

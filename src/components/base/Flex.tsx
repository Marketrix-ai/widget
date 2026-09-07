import { forwardRef, type ReactNode } from 'react';

import { Surface, type SurfaceProps } from './Surface';

export interface FlexProps extends SurfaceProps {
  direction?: 'row' | 'column';
  children?: ReactNode;
}

export const Flex = forwardRef<HTMLElement, FlexProps>(function Flex(props, ref) {
  const { direction, hidden, style, ...rest } = props;
  return (
    <Surface
      {...rest}
      ref={ref}
      hidden={hidden}
      style={{
        // Resolved here rather than left to `resolveLayoutStyle`, which Surface applies first: a
        // `display: flex` arriving later would otherwise silently defeat `hidden`.
        display: hidden === true ? 'none' : 'flex',
        ...(direction === 'column' && { flexDirection: 'column' }),
        ...style,
      }}
    />
  );
});

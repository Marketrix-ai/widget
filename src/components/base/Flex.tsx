/**
 * The two flex containers over `Surface`: `Flex` (`FlexProps`, `direction` defaulting to `row`) and
 * `Stack`, which is `Flex` with `direction='column'`.
 */
import type { ReactNode } from 'react';

import { Surface, type SurfaceProps } from './Surface';

interface FlexProps extends SurfaceProps {
  direction?: 'row' | 'column';
  children?: ReactNode;
}

type StackProps = Omit<FlexProps, 'direction'>;

export function Flex({ direction, style, ...rest }: FlexProps) {
  return (
    <Surface
      {...rest}
      style={{
        display: 'flex',
        ...(direction === 'column' && { flexDirection: 'column' }),
        ...style,
      }}
    />
  );
}

export function Stack(props: StackProps) {
  return <Flex {...props} direction='column' />;
}

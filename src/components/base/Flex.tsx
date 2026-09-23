/**
 * The two flex containers over `Surface`: `Flex` (`FlexProps`, `direction` defaulting to `row`) and
 * `Stack`, which is `Flex` with `direction='column'`.
 * `display` is resolved here from `hidden`, because `Surface` applies layout tokens before the caller's
 * style and a later `display: flex` would silently defeat `hidden`.
 */
import type { ReactNode } from 'react';

import { Surface, type SurfaceProps } from './Surface';

interface FlexProps extends SurfaceProps {
  direction?: 'row' | 'column';
  children?: ReactNode;
}

type StackProps = Omit<FlexProps, 'direction'>;

export function Flex({ direction, hidden, style, ...rest }: FlexProps) {
  return (
    <Surface
      {...rest}
      hidden={hidden}
      style={{
        display: hidden === true ? 'none' : 'flex',
        ...(direction === 'column' && { flexDirection: 'column' }),
        ...style,
      }}
    />
  );
}

export function Stack(props: StackProps) {
  return <Flex {...props} direction='column' />;
}

/**
 * `Flex` is the flex-container flavour of `Surface`: `FlexProps` extends `SurfaceProps` with
 * `direction` (`row` default, `column` opt-in) and children, and the forwardRef component spreads the
 * rest onto `Surface` so the whole layout-token vocabulary still applies.
 *
 * `display` is resolved here rather than left to `resolveLayoutStyle`, which `Surface` applies BEFORE
 * the caller's `style`: a `display: flex` arriving later in that cascade would silently defeat
 * `hidden`, so this component reads `hidden` itself and emits `none` or `flex` from the one place that
 * wins.
 */
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
        display: hidden === true ? 'none' : 'flex',
        ...(direction === 'column' && { flexDirection: 'column' }),
        ...style,
      }}
    />
  );
});

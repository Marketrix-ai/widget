import { forwardRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { getElevationStyle, type RadiusToken } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';
import { type LayoutProps, resolveLayoutClasses, stripLayoutProps } from './layoutProps';
import { backgroundClasses, paddingPresetClasses, type SurfaceBackground, type SurfacePadding } from './Surface';

export interface FlexProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'className'> {
  background?: SurfaceBackground;
  direction?: 'row' | 'column';
  elevation?: ShadowToken;
  paddingPreset?: SurfacePadding;
  radius?: RadiusToken;
  /** @internal blocks/ only */
  className?: string;
  children?: ReactNode;
}

export const Flex = forwardRef<HTMLElement, FlexProps>(function Flex(props, ref) {
  const {
    as: Component = 'div',
    background = 'default',
    direction,
    className,
    elevation,
    paddingPreset = 'none',
    radius,
    style,
    ...rest
  } = props;
  const layoutClasses = resolveLayoutClasses(props);
  const domProps = stripLayoutProps(rest);

  return (
    <Component
      {...domProps}
      ref={ref}
      className={cn(
        'flex',
        direction === 'column' && 'flex-col',
        backgroundClasses[background],
        paddingPresetClasses[paddingPreset],
        radius && resolveLayoutClasses({ rounded: radius }),
        layoutClasses,
        className,
      )}
      style={{ ...getElevationStyle(elevation), ...style }}
    />
  );
});

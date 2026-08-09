import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { getElevationStyle, type RadiusToken } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';
import { type LayoutProps, resolveLayoutClasses, stripLayoutProps } from './layoutProps';
import { backgroundClasses, paddingPresetClasses, type SurfaceBackground, type SurfacePadding } from './Surface';

export interface StackProps extends LayoutProps, Omit<ComponentPropsWithRef<'div'>, 'className'> {
  background?: SurfaceBackground;
  elevation?: ShadowToken;
  paddingPreset?: SurfacePadding;
  radius?: RadiusToken;
  /** @internal blocks/ only */
  className?: string;
  children?: ReactNode;
}

export function Stack(props: StackProps) {
  const { background = 'default', className, elevation, paddingPreset = 'none', radius, ref, style, ...rest } = props;
  const layoutClasses = resolveLayoutClasses(props);
  const domProps = stripLayoutProps(rest);

  return (
    <div
      {...domProps}
      ref={ref}
      className={cn(
        'flex flex-col',
        backgroundClasses[background],
        paddingPresetClasses[paddingPreset],
        radius && resolveLayoutClasses({ rounded: radius }),
        layoutClasses,
        className,
      )}
      style={{ ...getElevationStyle(elevation), ...style }}
    />
  );
}

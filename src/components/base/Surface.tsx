import { type ElementType, forwardRef } from 'react';

import { cn } from '@/lib/utils';

import { getElevationStyle, type RadiusToken } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';
import { type LayoutProps, resolveLayoutClasses, stripLayoutProps } from './layoutProps';

export type SurfaceBackground = 'default' | 'card' | 'transparent' | 'muted' | 'secondary' | 'primary';
export type SurfacePadding = 'none' | 'compact' | 'card' | 'dialog' | 'toast';

export interface SurfaceProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'className'> {
  as?: ElementType;
  background?: SurfaceBackground;
  elevation?: ShadowToken;
  paddingPreset?: SurfacePadding;
  radius?: RadiusToken;
  /** @internal blocks/ only */
  className?: string;
}

export const backgroundClasses: Record<SurfaceBackground, string> = {
  default: '',
  card: 'bg-card text-card-foreground',
  transparent: 'bg-transparent',
  muted: 'bg-muted',
  secondary: 'bg-secondary-bg',
  primary: 'bg-primary text-primary-foreground',
};

export const paddingPresetClasses: Record<SurfacePadding, string> = {
  none: '',
  compact: 'px-2 py-1.5',
  card: 'px-3 py-2',
  dialog: 'p-4',
  toast: 'py-2 pl-2 pr-3',
};

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(props, ref) {
  const {
    as: Component = 'div',
    background = 'default',
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

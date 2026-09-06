import { type CSSProperties, type ElementType, forwardRef } from 'react';

import { getElevationStyle } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';
import { type LayoutProps, resolveLayoutStyle, stripLayoutProps } from './layoutProps';

export type SurfaceBackground = 'default' | 'card';
export type SurfacePadding = 'none' | 'card' | 'toast';

export interface SurfaceProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'className'> {
  as?: ElementType;
  background?: SurfaceBackground;
  elevation?: ShadowToken;
  paddingPreset?: SurfacePadding;
  /** @internal blocks/ only */
  className?: string;
}

export const backgroundStyles: Record<SurfaceBackground, CSSProperties> = {
  default: {},
  card: { backgroundColor: 'var(--card)', color: 'var(--card-foreground)' },
};

export const paddingPresetStyles: Record<SurfacePadding, CSSProperties> = {
  none: {},
  card: { padding: '8px 12px' },
  toast: { padding: '8px 12px 8px 8px' },
};

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(props, ref) {
  const {
    as: Component = 'div',
    background = 'default',
    className,
    elevation,
    paddingPreset = 'none',
    style,
    ...rest
  } = props;
  const domProps = stripLayoutProps(rest);

  return (
    <Component
      {...domProps}
      ref={ref}
      className={className}
      style={{
        ...backgroundStyles[background],
        ...paddingPresetStyles[paddingPreset],
        ...getElevationStyle(elevation),
        ...resolveLayoutStyle(props),
        ...style,
      }}
    />
  );
});

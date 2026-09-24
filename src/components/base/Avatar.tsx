/**
 * `Avatar` — an `<img>` sized in pixels (32 by default), with fit, radius (via `resolveLayoutStyle`) and
 * elevation from the design tokens; keeps its own class beside a caller className.
 */
import type { ComponentPropsWithRef } from 'react';

import { getElevationStyle, type RadiusToken, type ShadowToken } from '../../design-system/component-tokens';
import { resolveLayoutStyle, withClass } from './layoutProps';

interface AvatarProps extends Omit<ComponentPropsWithRef<'img'>, 'size'> {
  src: string;
  alt: string;
  elevation?: ShadowToken;
  fit?: 'contain' | 'cover';
  size?: number;
  rounded?: RadiusToken;
}

export function Avatar(props: AvatarProps) {
  const { src, alt, elevation, fit = 'contain', size = 32, rounded, className, style, ref, ...imgProps } = props;

  return (
    <img
      {...imgProps}
      ref={ref}
      alt={alt}
      className={withClass('mtx-avatar', className)}
      src={src}
      style={{
        objectFit: fit,
        width: size,
        height: size,
        ...resolveLayoutStyle({ rounded }),
        ...getElevationStyle(elevation),
        ...style,
      }}
    />
  );
}

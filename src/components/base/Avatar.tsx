/**
 * `Avatar` — an `<img>` sized by preset or number, with fit, radius (via `resolveLayoutStyle`) and
 * elevation from the design tokens; keeps its own class beside a caller className.
 */
import type { ComponentPropsWithRef } from 'react';

import { getElevationStyle, type RadiusToken, type ShadowToken } from '../../design-system/component-tokens';
import { resolveLayoutStyle } from './layoutProps';

type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends Omit<ComponentPropsWithRef<'img'>, 'size'> {
  src: string;
  alt: string;
  elevation?: ShadowToken;
  fit?: 'contain' | 'cover';
  size?: AvatarSize | number;
  rounded?: boolean | RadiusToken;
}

const SIZE: Record<AvatarSize, number> = { sm: 20, md: 32, lg: 48 };

export function Avatar(props: AvatarProps) {
  const { src, alt, elevation, fit = 'contain', size = 'md', rounded, className, style, ref, ...imgProps } = props;
  const resolved = typeof size === 'string' ? SIZE[size] : size;

  return (
    <img
      {...imgProps}
      ref={ref}
      alt={alt}
      className={className ? `mtx-avatar ${className}` : 'mtx-avatar'}
      src={src}
      style={{
        objectFit: fit,
        width: resolved,
        height: resolved,
        ...resolveLayoutStyle({ rounded }),
        ...getElevationStyle(elevation),
        ...style,
      }}
    />
  );
}

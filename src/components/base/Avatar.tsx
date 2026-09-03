import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/utils';

import { getElevationStyle, type RadiusToken } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';
import { resolveLayoutClasses } from './layoutProps';

type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends Omit<ComponentPropsWithRef<'img'>, 'size'> {
  src: string;
  alt: string;
  elevation?: ShadowToken;
  fit?: 'contain' | 'cover';
  size?: AvatarSize | number;
  rounded?: boolean | 'full' | 'theme' | RadiusToken;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function Avatar(props: AvatarProps) {
  const { src, alt, elevation, fit = 'contain', size = 'md', rounded, className, style, ref, ...imgProps } = props;
  const isPreset = typeof size === 'string';
  const sizeClass = isPreset ? sizeStyles[size] : undefined;
  const sizeStyle = !isPreset ? { width: size, height: size, ...style } : style;
  const roundedClass = resolveLayoutClasses({ rounded });

  return (
    <img
      {...imgProps}
      ref={ref}
      alt={alt}
      className={cn(
        'flex-shrink-0',
        fit === 'contain' ? 'object-contain' : 'object-cover',
        sizeClass,
        roundedClass,
        className,
      )}
      src={src}
      style={{ ...getElevationStyle(elevation), ...sizeStyle }}
    />
  );
}

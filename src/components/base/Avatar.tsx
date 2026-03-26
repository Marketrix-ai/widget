import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

import { getElevationStyle, radiusClasses, type RadiusToken } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';

type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'size'> {
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

export const Avatar = forwardRef<HTMLImageElement, AvatarProps>(function Avatar(
  { src, alt, elevation, fit = 'contain', size = 'md', rounded, className, style, ...props },
  ref,
) {
  const isPreset = typeof size === 'string';
  const sizeClass = isPreset ? sizeStyles[size] : undefined;
  const sizeStyle = !isPreset ? { width: size, height: size, ...style } : style;
  const roundedClass =
    rounded === true || rounded === 'theme'
      ? radiusClasses.theme
      : rounded === 'full'
        ? radiusClasses.pill
        : rounded
          ? radiusClasses[rounded]
          : undefined;

  return (
    <img
      {...props}
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
});

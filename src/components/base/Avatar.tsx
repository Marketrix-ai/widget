import { forwardRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'size'> {
  src: string;
  alt: string;
  size?: AvatarSize | number;
  fallback?: ReactNode;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export const Avatar = forwardRef<HTMLImageElement, AvatarProps>(function Avatar(
  { src, alt, size = 'md', fallback: _fallback, className, style, ...props },
  ref,
) {
  const isPreset = typeof size === 'string';
  const sizeClass = isPreset ? sizeStyles[size] : undefined;
  const sizeStyle = !isPreset ? { width: size, height: size, ...style } : style;

  return (
    <img
      {...props}
      ref={ref}
      alt={alt}
      className={cn('flex-shrink-0 object-contain', sizeClass, className)}
      src={src}
      style={sizeStyle}
    />
  );
});

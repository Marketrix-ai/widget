import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

type AvatarSize = 'md';

export interface AvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'size'> {
  src: string;
  alt: string;
  size?: AvatarSize | number;
  rounded?: boolean | 'full' | 'theme';
}

const sizeStyles: Record<AvatarSize, string> = {
  md: 'w-8 h-8',
};

export const Avatar = forwardRef<HTMLImageElement, AvatarProps>(function Avatar(
  { src, alt, size = 'md', rounded, className, style, ...props },
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
      className={cn(
        'flex-shrink-0 object-contain',
        sizeClass,
        (rounded === true || rounded === 'theme') && 'rounded-[var(--radius)]',
        rounded === 'full' && 'rounded-full',
        className,
      )}
      src={src}
      style={sizeStyle}
    />
  );
});

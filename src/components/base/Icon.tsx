import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/utils';

import { type IconData, type IconName, icons } from './icons';

export interface IconProps extends ComponentPropsWithRef<'svg'> {
  name: IconName;
  size?: number;
  /** @internal blocks/ only */
  className?: string;
}

export function Icon({ name, size = 16, className, ref, ...props }: IconProps) {
  const icon = icons[name] as IconData | undefined;
  if (!icon) return null;

  return (
    <svg
      {...props}
      ref={ref}
      aria-hidden='true'
      className={cn('inline-block flex-shrink-0', className)}
      fill='none'
      height={size}
      viewBox={icon.viewBox}
      width={size}
      xmlns='http://www.w3.org/2000/svg'
    >
      {icon.paths.map((p, i) => (
        <path
          key={i}
          clipRule={p.clipRule}
          d={p.d}
          fill={p.fill ?? (p.stroke ? 'none' : 'currentColor')}
          fillRule={p.fillRule}
          stroke={p.stroke}
          strokeLinecap={p.strokeLinecap}
          strokeLinejoin={p.strokeLinejoin}
          strokeMiterlimit={p.strokeMiterlimit}
          strokeWidth={p.strokeWidth}
        />
      ))}
    </svg>
  );
}

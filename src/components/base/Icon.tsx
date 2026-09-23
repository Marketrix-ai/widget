/**
 * `Icon` — the widget's one SVG glyph primitive: renders `name` from the `icons` registry as a square
 * `<svg>` of `size`, forwarding ref and svg props.
 * Glyphs are decorative, so the accessible name belongs on the wrapping control. A caller `className` must
 * have a real `index.css` rule, since there is no CSS framework.
 */
import type { ComponentPropsWithRef } from 'react';

import { type IconData, type IconName, icons } from './icons';
import { withClass } from './layoutProps';

interface IconProps extends ComponentPropsWithRef<'svg'> {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className, ref, ...props }: IconProps) {
  const icon: IconData = icons[name];

  return (
    <svg
      {...props}
      ref={ref}
      aria-hidden='true'
      className={withClass('mtx-icon', className)}
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

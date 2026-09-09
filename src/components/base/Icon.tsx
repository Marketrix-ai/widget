/**
 * `Icon` — the widget's one SVG glyph primitive: resolves `name` in the `icons` registry and renders a
 * square `<svg>` of `size` (default 16), forwarding ref and any other svg prop. An unknown name renders
 * null, so a stale name degrades to a gap rather than a crash.
 *
 * Glyphs are decorative, so `aria-hidden` is fixed here and the accessible name belongs on the control
 * wrapping the icon. A path's fill defaults to `currentColor` — unless it sets a `stroke`, where the
 * default is `none`; that resolution is what lets `icons.ts`'s `stroked()` omit `fill` altogether.
 * `mtx-icon` (the layout rule in `index.css`) always applies and a caller `className` is appended to it,
 * never substituted — and `className` is for `blocks/` only: with no CSS framework here every class must
 * have a real `index.css` rule, and `WidgetFab`'s `mtx-fab-chevron` is the sole production caller.
 */
import type { ComponentPropsWithRef } from 'react';

import { type IconData, type IconName, icons } from './icons';

export interface IconProps extends ComponentPropsWithRef<'svg'> {
  name: IconName;
  size?: number;
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
      className={className ? `mtx-icon ${className}` : 'mtx-icon'}
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

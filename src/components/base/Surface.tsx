/**
 * `Surface` is the canonical container primitive: a polymorphic `forwardRef` element (`as`, default
 * `div`) that composes the shared layout-token vocabulary with a `background` token, a `SHADOW`
 * `elevation` token and a `paddingPreset`, all emitted as inline style. `SurfaceBackground` and
 * `SurfacePadding` are those token unions, `backgroundStyles` and `paddingPresetStyles` their lookup
 * tables — the `default`/`none` entries are empty, so a bare `Surface` is a plain element — and
 * `SurfaceProps` the prop surface: `LayoutProps` plus the host element's HTML attributes.
 *
 * `className` is dropped from those attributes and re-declared because it is INTERNAL to `blocks/`:
 * layout props are the styling API everywhere else, and the only legitimate classes are the
 * `index.css` hooks the block components key on.
 *
 * Style order is fixed and load-bearing: background → padding preset → elevation → layout props →
 * the caller's own `style` last, so an inline style always wins. `Flex` depends on that tail
 * position, resolving `display` itself because `resolveLayoutStyle` is applied ahead of it.
 *
 * `resolveLayoutStyle` is handed the whole `props` (it reads only layout keys), while the DOM spread
 * goes through `stripLayoutProps` — a layout token left on the props bag reaches the element as an
 * unknown attribute.
 */
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
  className?: string;
}

const backgroundStyles: Record<SurfaceBackground, CSSProperties> = {
  default: {},
  card: { backgroundColor: 'var(--card)', color: 'var(--card-foreground)' },
};

const paddingPresetStyles: Record<SurfacePadding, CSSProperties> = {
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

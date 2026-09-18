/**
 * `Surface` is the canonical container primitive: a polymorphic element (`div` by default) that composes
 * the shared layout-token vocabulary with a background token, an elevation token and a padding preset,
 * all emitted as inline style.
 *
 * `floatingCard` is a `variant` shorthand for the card look both the home view's recent-chat
 * card and the chat view's composer card use. Style precedence is fixed: background, then padding, then
 * elevation, then layout props, then the caller's own `style` last, so a caller override always wins.
 * `className` is internal to `blocks/` — layout props are the styling API everywhere else.
 */
import { type CSSProperties, type ElementType, forwardRef } from 'react';

import { getElevationStyle, type ShadowToken } from '../../design-system/component-tokens';
import { type LayoutProps, resolveLayoutStyle, stripLayoutProps } from './layoutProps';

type SurfaceBackground = 'default' | 'card';
type SurfacePadding = 'none' | 'card' | 'toast';

type SurfaceVariant = 'floatingCard';

export interface SurfaceProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'className'> {
  as?: ElementType;
  background?: SurfaceBackground;
  elevation?: ShadowToken;
  paddingPreset?: SurfacePadding;
  variant?: SurfaceVariant;
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

const variantProps: Record<
  SurfaceVariant,
  Pick<SurfaceProps, 'background' | 'border' | 'elevation' | 'paddingPreset' | 'rounded'>
> = {
  floatingCard: { background: 'card', border: true, elevation: 'card', paddingPreset: 'card', rounded: 'xl' },
};

const variantStyles: Record<SurfaceVariant, CSSProperties> = {
  floatingCard: { margin: '0 12px 12px 12px' },
};

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(props, ref) {
  const { as: Component = 'div', className, style, variant, ...withVariant } = props;
  const merged = variant ? { ...variantProps[variant], ...withVariant } : withVariant;
  const { background = 'default', elevation, paddingPreset = 'none', ...rest } = merged;
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
        ...resolveLayoutStyle(merged),
        ...(variant && variantStyles[variant]),
        ...style,
      }}
    />
  );
});

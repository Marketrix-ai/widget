/**
 * `Surface` is the canonical container primitive: a polymorphic `forwardRef` element (`as`, default
 * `div`) that composes the shared layout-token vocabulary with a `background` token, a `SHADOW`
 * `elevation` token and a `paddingPreset`, all emitted as inline style — the `default`/`none` lookup
 * entries are empty, so a bare `Surface` is a plain element. `className` is dropped from the host
 * attributes and re-declared because it is INTERNAL to `blocks/`: layout props are the styling API
 * everywhere else, and the only legitimate classes are the `index.css` hooks the block components key on.
 *
 * `floatingCard` is a `variant` shorthand for the card-background/border/card-elevation/card-padding/xl-
 * rounded/margin bundle both `HomeView`'s recent-conversation card and `ChatView`'s composer card use —
 * the margin lives in `variantStyles` since both call sites want it, while `ChatView`'s extra
 * `marginTop: 'auto'` stays an override on its own `style` prop rather than joining the preset.
 *
 * Style order is fixed and load-bearing: background → padding preset → elevation → layout props → the
 * caller's own `style` last, so an inline style always wins; `Flex` depends on that tail position,
 * resolving `display` itself because `resolveLayoutStyle` is applied ahead of it. `resolveLayoutStyle`
 * is handed the whole `props` (it reads only layout keys), while the DOM spread goes through
 * `stripLayoutProps` — a layout token left on the props bag reaches the element as an unknown attribute.
 *
 * `forwardRef<HTMLElement, SurfaceProps>` is fixed, not generic per `as`: `forwardRef` cannot be made
 * generic across call sites without its own internal cast, so a caller holding a `RefObject` typed to
 * its specific element (`HTMLDivElement`, …) casts at the call site instead — `RefObject.current` is
 * mutable and therefore invariant, so no subtyping relationship lets a `RefObject<HTMLDivElement>` stand
 * in for `Ref<HTMLElement>` without one. `WidgetFab.tsx`, `MessageList.tsx` (×2) are the three sites.
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

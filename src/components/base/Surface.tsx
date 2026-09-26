/**
 * `Surface` is the canonical container primitive: a polymorphic element (`div` by default) that composes
 * the shared layout-token vocabulary with an elevation token, all emitted as inline style. `floatingCard` is
 * the card look the recent-chat card and the composer share; the caller's own `style` always wins.
 */
import type { CSSProperties, ElementType, Ref } from 'react';

import { getElevationStyle, type ShadowToken } from '../../design-system/component-tokens';
import { type LayoutProps, splitLayout } from './layoutProps';

export interface SurfaceProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'className'> {
  as?: ElementType;
  elevation?: ShadowToken;
  floatingCard?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export const CARD_COLORS: CSSProperties = { backgroundColor: 'var(--card)', color: 'var(--card-foreground)' };
const FLOATING_CARD = { border: true, elevation: 'card', rounded: 'xl' } satisfies SurfaceProps;
const FLOATING_CARD_STYLE: CSSProperties = { ...CARD_COLORS, padding: '8px 12px', margin: '0 12px 12px 12px' };

export function Surface(props: SurfaceProps) {
  const { as: Component = 'div', className, style, floatingCard, ref, ...own } = props;
  const { elevation, ...rest } = floatingCard ? { ...FLOATING_CARD, ...own } : own;
  const [layoutStyle, domProps] = splitLayout(rest);

  return (
    <Component
      {...domProps}
      ref={ref}
      className={className}
      style={{ ...(floatingCard && FLOATING_CARD_STYLE), ...getElevationStyle(elevation), ...layoutStyle, ...style }}
    />
  );
}

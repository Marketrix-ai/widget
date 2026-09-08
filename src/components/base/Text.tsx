/**
 * `Text` — the widget's typography primitive; every rendered string goes through it.
 *
 * Contents: `TextProps` (prop surface, extending the rendered element's HTML attributes) · `Text`,
 * which renders `as` (default `span`) and folds tone, size, weight, align, leading, block, italic
 * and truncation into ONE inline style object · the `SIZE` / `WEIGHT` / `TRUNCATE` lookups it reads.
 *
 * Styling is inline only — the widget has no CSS framework and no `cn()`, so a variant is a style
 * value here, never a class name. Tone and leading come from `design-system/component-tokens`, the
 * shared home for those scales; the size, weight and truncate maps stay local because nothing but
 * text reads them. Every optional prop is spread only when set, so an unset one inherits from the
 * cascade rather than being pinned to a default, and the caller's `style` spreads LAST so it wins
 * over every resolved token. `inheritColor` overrides `variant` and resolves to `TEXT_TONE.inherit`,
 * letting text inside an already-coloured container (button, badge) take that colour.
 *
 * `className` is an escape hatch for `blocks/` only — product code styles through the props above.
 */
import type { CSSProperties, ElementType, Ref } from 'react';

import { TEXT_LEADING, TEXT_TONE, type TextLeading } from '../../design-system/component-tokens';

type TextVariant = 'default' | 'muted' | 'faint';
type TextSize = 'xxs' | 'xs' | 'sm' | 'lg';
type TextWeight = 'normal' | 'medium' | 'semibold';
type TextAlign = 'center' | 'right';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: ElementType;
  block?: boolean;
  inheritColor?: boolean;
  italic?: boolean;
  leading?: TextLeading;
  variant?: TextVariant;
  size?: TextSize;
  weight?: TextWeight;
  truncate?: boolean;
  align?: TextAlign;
  className?: string;
  ref?: Ref<HTMLElement>;
}

const SIZE: Record<TextSize, string> = {
  xxs: '10px',
  xs: '0.75rem',
  sm: '0.875rem',
  lg: '1.125rem',
};

const WEIGHT: Record<TextWeight, number> = { normal: 400, medium: 500, semibold: 600 };

const TRUNCATE: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

export function Text({
  as: Component = 'span',
  block = false,
  inheritColor = false,
  italic = false,
  leading,
  variant = 'default',
  size,
  weight,
  truncate,
  align,
  className,
  ref,
  style,
  ...props
}: TextProps) {
  return (
    <Component
      {...props}
      ref={ref}
      className={className}
      style={{
        color: TEXT_TONE[inheritColor ? 'inherit' : variant],
        ...(size && { fontSize: SIZE[size] }),
        ...(weight && { fontWeight: WEIGHT[weight] }),
        ...(align && { textAlign: align }),
        ...(leading && { lineHeight: TEXT_LEADING[leading] }),
        ...(block && { display: 'block' }),
        ...(italic && { fontStyle: 'italic' }),
        ...(truncate && TRUNCATE),
        ...style,
      }}
    />
  );
}

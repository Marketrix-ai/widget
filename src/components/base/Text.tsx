/**
 * `Text` is the widget's typography primitive; every rendered string goes through it.
 *
 * `Text` renders as any element (`span` by default) and folds tone, size, weight, align, leading,
 * block, italic and truncation into one inline style object, using the local `SIZE`/`WEIGHT`/`TRUNCATE`
 * lookups plus the shared tone/leading scales. Styling is inline only, since the widget has no CSS
 * framework. An unset optional prop is left out of the style object so it inherits from the cascade,
 * and the caller's own `style` is spread last so it always wins.
 */
import type { CSSProperties, ElementType, Ref } from 'react';

import { TEXT_LEADING, TEXT_TONE, type TextLeading } from '../../design-system/component-tokens';

type TextVariant = 'default' | 'muted' | 'faint';
type TextSize = 'xxs' | 'xs' | 'sm' | 'lg';
type TextWeight = 'normal' | 'medium' | 'semibold';
type TextAlign = 'center' | 'right';

interface TextProps extends React.HTMLAttributes<HTMLElement> {
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
  ref,
  style,
  ...props
}: TextProps) {
  return (
    <Component
      {...props}
      ref={ref}
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

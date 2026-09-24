/**
 * `Text` is the widget's typography primitive; every rendered string goes through it. It renders as any
 * element (`span` by default) and folds tone, size, weight, align, line height, block, italic and truncation
 * into one inline style; an unset prop inherits from the cascade and the caller's `style` wins.
 */
import type { CSSProperties, ElementType, Ref } from 'react';

import { TEXT_TONE } from '../../design-system/component-tokens';

type TextVariant = 'default' | 'muted' | 'faint';
type TextSize = 'xxs' | 'xs' | 'sm' | 'lg';
type TextWeight = 'normal' | 'medium' | 'semibold';
type TextAlign = 'center' | 'right';

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: ElementType;
  block?: boolean;
  inheritColor?: boolean;
  italic?: boolean;
  tight?: boolean;
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
  tight,
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
        ...(tight && { lineHeight: 1.25 }),
        ...(block && { display: 'block' }),
        ...(italic && { fontStyle: 'italic' }),
        ...(truncate && TRUNCATE),
        ...style,
      }}
    />
  );
}

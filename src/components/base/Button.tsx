import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentPropsWithRef } from 'react';

import { getElevationStyle, RADIUS } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'bare' | 'chip' | 'tab';
type ButtonSize = 'sm' | 'md';
type ButtonShape = 'default' | 'theme' | 'pill';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  elevation?: ShadowToken;
  size?: ButtonSize;
  shape?: ButtonShape;
  stacked?: boolean;
  variant?: ButtonVariant;
  full?: boolean;
}

const SHAPE_RADIUS: Record<ButtonShape, string> = {
  default: RADIUS.lg,
  theme: RADIUS.theme,
  pill: RADIUS.pill,
};

export function Button({
  className,
  disabled,
  elevation,
  full,
  shape = 'default',
  size = 'md',
  stacked = false,
  type = 'button',
  variant = 'primary',
  style,
  ref,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      ref={ref}
      className={className ? `mtx-button ${className}` : 'mtx-button'}
      data-disabled={disabled ? 'true' : 'false'}
      data-full={full ? 'true' : 'false'}
      data-size={size}
      data-stacked={stacked ? 'true' : 'false'}
      data-variant={variant}
      disabled={disabled}
      style={{ borderRadius: SHAPE_RADIUS[shape], ...getElevationStyle(elevation), ...style }}
      type={type}
    />
  );
}

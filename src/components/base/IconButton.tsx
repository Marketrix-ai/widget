import type { ComponentPropsWithRef } from 'react';

import { TEXT_TONE, type TextTone } from '../../design-system/component-tokens';

type IconButtonVariant = 'primary' | 'secondary' | 'ghost';
type IconButtonSize = 'xs' | 'sm';

export interface IconButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  tone?: TextTone;
  label: string;
}

export function IconButton({
  variant = 'ghost',
  size = 'sm',
  tone,
  label,
  disabled,
  children,
  style,
  ref,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      ref={ref}
      type='button'
      disabled={disabled}
      aria-label={label}
      className='mtx-icon-button'
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-variant={variant}
      style={tone ? { color: TEXT_TONE[tone], ...style } : style}
    >
      {children}
    </button>
  );
}

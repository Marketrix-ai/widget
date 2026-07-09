import { forwardRef } from 'react';

import type { RadiusToken } from '../../design-system/component-tokens';
import type { ShadowToken } from '../../design-system/shadows';
import { Surface } from './Surface';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  background?: 'card' | 'transparent';
  border?: boolean | 'top' | 'bottom';
  elevation?: ShadowToken;
  paddingPreset?: 'compact' | 'card';
  radius?: RadiusToken;
  /** @internal */
  className?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    background = 'card',
    border = true,
    children,
    className,
    elevation = 'card',
    paddingPreset = 'card',
    radius = 'xl',
    style,
    ...props
  },
  ref,
) {
  return (
    <Surface
      {...props}
      ref={ref as React.Ref<HTMLElement>}
      as='div'
      background={background}
      border={border}
      className={className}
      elevation={elevation}
      paddingPreset={paddingPreset}
      radius={radius}
      style={style}
    >
      {children}
    </Surface>
  );
});

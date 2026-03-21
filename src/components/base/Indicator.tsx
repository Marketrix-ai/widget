import React from 'react';

type IndicatorVariant = 'bar';
type IndicatorColor = 'accent';

export interface IndicatorProps {
  variant?: IndicatorVariant;
  color?: IndicatorColor;
}

export const Indicator: React.FC<IndicatorProps> = () => {
  return <span className='block h-0.5 w-full rounded-full bg-primary' />;
};

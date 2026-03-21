import { cn } from '@/lib/utils';

type IndicatorVariant = 'bar' | 'dot';
type IndicatorColor = 'accent' | 'success' | 'warning';

export interface IndicatorProps {
  variant?: IndicatorVariant;
  color?: IndicatorColor;
  animated?: boolean;
}

const colorStyles: Record<IndicatorColor, string> = {
  accent: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
};

const variantStyles: Record<IndicatorVariant, string> = {
  bar: 'h-0.5 rounded-full',
  dot: 'w-1.5 h-1.5 rounded-full',
};

export const Indicator: React.FC<IndicatorProps> = ({ variant = 'bar', color = 'accent', animated = false }) => {
  return <span className={cn(variantStyles[variant], colorStyles[color], animated && 'animate-pulse')} />;
};

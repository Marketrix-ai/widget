import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

import { SHADOW } from '../../design-system/shadows';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @internal */
  className?: string;
}

/**
 * A card surface with consistent border-radius, shadow, and white background.
 * Used for: recent conversation card, help about card, chat input container, etc.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ className, style, children, ...props }, ref) {
  return (
    <div
      {...props}
      ref={ref}
      className={cn(className)}
      style={{
        padding: '6px 10px',
        borderRadius: 'var(--radius-xl, 12px)',
        border: '1px solid transparent',
        backgroundColor: '#ffffff',
        boxShadow: SHADOW.card,
        ...style,
      }}
    >
      {children}
    </div>
  );
});

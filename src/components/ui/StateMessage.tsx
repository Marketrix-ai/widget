import React from 'react';

import { cn } from '@/lib/utils';

type StateMessageVariant = 'loading' | 'empty' | 'error';

interface StateMessageProps {
  variant: StateMessageVariant;
  message: string;
  className?: string;
  /** Optional recovery action label (e.g. "Retry") */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Standardized skeleton/loading, empty, and error states using design tokens.
 * Use in message list, composer, or any surface that needs consistent state UI.
 */
export const StateMessage: React.FC<StateMessageProps> = ({ variant, message, className, actionLabel, onAction }) => {
  const isError = variant === 'error';
  const isLoading = variant === 'loading';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-6 px-4 text-center',
        isError && 'text-red-600',
        className,
      )}
      role={isLoading ? 'status' : undefined}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {isLoading && (
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent' aria-hidden />
      )}
      <p className='text-sm'>{message}</p>
      {actionLabel && onAction && (
        <button
          type='button'
          onClick={onAction}
          className='text-sm font-medium underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded'
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

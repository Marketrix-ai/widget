import React from 'react';

import { cn } from '@/lib/utils';

import { Button } from '../base/Button';
import { Spinner } from '../base/Spinner';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

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
    <Stack
      className={cn('items-center justify-center gap-3 py-6 px-4 text-center', isError && 'text-red-600', className)}
      role={isLoading ? 'status' : undefined}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {isLoading && <Spinner size='lg' />}
      <Text as='p' size='sm'>
        {message}
      </Text>
      {actionLabel && onAction && (
        <Button
          type='button'
          variant='ghost'
          onClick={onAction}
          className='text-sm font-medium underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded'
        >
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
};

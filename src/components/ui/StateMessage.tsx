import React from 'react';

import { Button } from '../base/Button';
import { Spinner } from '../base/Spinner';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

type StateMessageVariant = 'loading' | 'empty' | 'error';

interface StateMessageProps {
  variant: StateMessageVariant;
  message: string;
  /** Optional recovery action label (e.g. "Retry") */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Standardized skeleton/loading, empty, and error states using design tokens.
 * Use in message list, composer, or any surface that needs consistent state UI.
 */
export const StateMessage: React.FC<StateMessageProps> = ({ variant, message, actionLabel, onAction }) => {
  const isError = variant === 'error';
  const isLoading = variant === 'loading';

  return (
    <Stack
      align='center'
      justify='center'
      gap='lg'
      paddingY='2xl'
      paddingX='xl'
      role={isLoading ? 'status' : undefined}
      aria-live={isError ? 'assertive' : 'polite'}
      style={isError ? { color: 'var(--color-red-600, #dc2626)' } : undefined}
    >
      {isLoading && <Spinner size='lg' />}
      <Text as='p' size='sm' align='center'>
        {message}
      </Text>
      {actionLabel && onAction && (
        <Button
          type='button'
          variant='ghost'
          onClick={onAction}
          style={{ fontSize: '0.875rem', fontWeight: 500, textDecoration: 'underline' }}
        >
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
};

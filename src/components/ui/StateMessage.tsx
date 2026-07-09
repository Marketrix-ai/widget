import React from 'react';

import { Spinner } from '../base/Spinner';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

type StateMessageVariant = 'loading' | 'empty' | 'error';

interface StateMessageProps {
  variant: StateMessageVariant;
  message: string;
}

export const StateMessage: React.FC<StateMessageProps> = ({ variant, message }) => {
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
    </Stack>
  );
};

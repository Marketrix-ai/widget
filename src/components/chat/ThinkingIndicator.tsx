import React from 'react';

import { Flex } from '../base/Flex';
import { Spinner } from '../base/Spinner';
import { Text } from '../base/Text';

interface ThinkingIndicatorProps {
  isWaitingForUser: boolean;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ isWaitingForUser }) => {
  return (
    <Flex align='center' gap='sm' paddingY='xs' className='text-foreground-faint'>
      <Spinner size='sm' />
      <Text as='span' size='xs' weight='normal'>
        {isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking'}
      </Text>
    </Flex>
  );
};

import React from 'react';

import { Flex } from '../base/Flex';
import { Spinner } from '../base/Spinner';
import { Text } from '../base/Text';

interface ThinkingIndicatorProps {
  isWaitingForUser: boolean;
  accentColor?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ isWaitingForUser, accentColor }) => {
  return (
    <Flex align='center' gap='sm' paddingY='xs'>
      <Spinner size='sm' style={{ color: accentColor }} />
      <Text as='span' size='xs' weight='normal' variant='faint'>
        {isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking'}
      </Text>
    </Flex>
  );
};

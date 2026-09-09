/**
 * `ThinkingIndicator` — the small spinner-and-caption row shown while a reply is pending; the caption
 * switches to "Waiting for you to complete the action" when the agent is blocked on the visitor.
 */
import React from 'react';

import { Flex } from '../base/Flex';
import { Spinner } from '../base/Spinner';
import { Text } from '../base/Text';

interface ThinkingIndicatorProps {
  isWaitingForUser: boolean;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ isWaitingForUser }) => {
  return (
    <Flex align='center' gap='sm' paddingY='2xs'>
      <Spinner size='sm' />
      <Text as='span' size='xs' weight='normal' variant='faint'>
        {isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking'}
      </Text>
    </Flex>
  );
};

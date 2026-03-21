import React from 'react';

import { addOpacity } from '../../utils/format';
import { Flex } from '../base/Flex';
import { Spinner } from '../base/Spinner';
import { Text } from '../base/Text';

interface ThinkingIndicatorProps {
  isWaitingForUser: boolean;
  textColor: string;
  customText?: string;
  accentColor?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  isWaitingForUser,
  textColor,
  customText,
  accentColor,
}) => {
  return (
    <Flex align='center' gap='sm' paddingY='xs'>
      {/* Spinner icon */}
      <Spinner size='sm' style={{ color: accentColor || addOpacity(textColor, 0.5) }} />
      {/* State text */}
      <Text as='span' weight='normal' style={{ fontSize: '10px', color: addOpacity(textColor, 0.5) }}>
        {customText || (isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking')}
      </Text>
    </Flex>
  );
};

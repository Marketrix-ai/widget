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
    <Flex className='items-center gap-1.5 py-0.5'>
      {/* Spinner icon */}
      <Spinner size='sm' className='flex-shrink-0' style={{ color: accentColor || addOpacity(textColor, 0.5) }} />
      {/* State text */}
      <Text as='span' className='text-[10px] font-inter font-normal' style={{ color: addOpacity(textColor, 0.5) }}>
        {customText || (isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking')}
      </Text>
    </Flex>
  );
};

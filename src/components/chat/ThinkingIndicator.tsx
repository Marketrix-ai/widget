import React from 'react';

import { useWidget } from '../../hooks/useWidget';
import { Flex } from '../base/Flex';
import { Spinner } from '../base/Spinner';
import { Text } from '../base/Text';

interface ThinkingIndicatorProps {
  isWaitingForUser: boolean;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ isWaitingForUser }) => {
  const { config: widgetConfig } = useWidget();
  return (
    <Flex align='center' gap='sm' paddingY='xs'>
      <Spinner size='sm' style={{ color: widgetConfig.widget_accent_color }} />
      <Text as='span' size='xs' weight='normal' variant='faint'>
        {isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking'}
      </Text>
    </Flex>
  );
};

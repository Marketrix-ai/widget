import React from 'react';

import { Flex } from '../base/Flex';
import { Text } from '../base/Text';

interface ProgressLineProps {
  content: string;
}

export const ProgressLine: React.FC<ProgressLineProps> = ({ content }) => {
  return (
    <Flex align='start' gap='md'>
      <Text
        as='span'
        size='xs'
        weight='medium'
        style={{
          flex: 1,
          whiteSpace: 'pre-wrap',
          lineHeight: 'tight',
        }}
      >
        {content}
      </Text>
    </Flex>
  );
};

import React from 'react';

import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Spinner } from '../base/Spinner';
import { Text } from '../base/Text';

interface ProgressLineProps {
  content: string;
  status?: 'running' | 'completed' | 'failed' | 'canceled' | 'pending';
  accentColor: string;
  hideIcon?: boolean;
  textStyle?: 'default' | 'muted';
}

export const ProgressLine: React.FC<ProgressLineProps> = ({
  content,
  status = 'pending',
  accentColor,
  hideIcon = false,
  textStyle = 'default',
}) => {
  const renderIcon = () => {
    switch (status) {
      case 'completed':
        return <Icon name='checkCircle' style={{ color: accentColor, marginTop: '2px', flexShrink: 0 }} size={16} />;
      case 'failed':
        return <Icon name='timesCircle' style={{ opacity: 0.65, marginTop: '2px', flexShrink: 0 }} size={16} />;
      case 'canceled':
        return <Icon name='ban' style={{ opacity: 0.5, marginTop: '2px', flexShrink: 0 }} size={16} />;
      case 'running':
        return <Spinner size='sm' style={{ color: accentColor, marginTop: '2px' }} />;
      case 'pending':
      default:
        return <Icon name='circle' style={{ opacity: 0.5, marginTop: '2px', flexShrink: 0 }} size={16} />;
    }
  };

  return (
    <Flex align='start' gap='md'>
      {!hideIcon && renderIcon()}
      <Text
        as='span'
        size='xs'
        weight='medium'
        style={{
          flex: 1,
          whiteSpace: 'pre-wrap',
          lineHeight: 'tight',
          opacity: textStyle === 'muted' ? 0.5 : 1,
        }}
      >
        {content}
      </Text>
    </Flex>
  );
};

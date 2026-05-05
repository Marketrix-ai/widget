import React from 'react';

import { useWidget } from '../../hooks/useWidget';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Spinner } from '../base/Spinner';
import { Text } from '../base/Text';

interface ProgressLineProps {
  content: string;
  status?: 'in_progress' | 'completed' | 'failed' | 'stopped';
  hideIcon?: boolean;
  textStyle?: 'default' | 'muted';
}

export const ProgressLine: React.FC<ProgressLineProps> = ({
  content,
  status,
  hideIcon = false,
  textStyle = 'default',
}) => {
  const { config: widgetConfig } = useWidget();
  const accentColor = widgetConfig.widget_accent_color;
  const renderIcon = () => {
    switch (status) {
      case 'completed':
        return <Icon name='checkCircle' style={{ color: accentColor, marginTop: '2px', flexShrink: 0 }} size={16} />;
      case 'failed':
        return <Icon name='timesCircle' style={{ opacity: 0.65, marginTop: '2px', flexShrink: 0 }} size={16} />;
      case 'stopped':
        return <Icon name='ban' style={{ opacity: 0.5, marginTop: '2px', flexShrink: 0 }} size={16} />;
      case 'in_progress':
      default:
        return <Spinner size='sm' style={{ color: accentColor, marginTop: '2px' }} />;
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

import React from 'react';

import { addOpacity } from '../../utils/format';
import { Icon } from '../base/Icon';
import { Spinner } from '../base/Spinner';

interface TaskStatusIconProps {
  status: 'ongoing' | 'done' | 'failed' | 'stopped';
  accentColor: string;
}

export const TaskStatusIcon: React.FC<TaskStatusIconProps> = ({ status, accentColor }) => {
  const iconSize = 14;

  switch (status) {
    case 'done':
      return <Icon name='checkCircle' style={{ color: accentColor, flexShrink: 0 }} size={iconSize} />;
    case 'failed':
      return (
        <Icon
          name='exclamationCircle'
          style={{ color: addOpacity(accentColor, 0.75), flexShrink: 0 }}
          size={iconSize}
        />
      );
    case 'stopped':
      return <Icon name='circle' style={{ color: addOpacity(accentColor, 0.5), flexShrink: 0 }} size={iconSize} />;
    case 'ongoing':
    default:
      return <Spinner size='sm' style={{ color: accentColor }} />;
  }
};

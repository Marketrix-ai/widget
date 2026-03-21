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
      return <Icon name='checkCircle' className='flex-shrink-0' style={{ color: accentColor }} size={iconSize} />;
    case 'failed':
      return (
        <Icon
          name='exclamationCircle'
          className='flex-shrink-0'
          style={{ color: addOpacity(accentColor, 0.75) }}
          size={iconSize}
        />
      );
    case 'stopped':
      return (
        <Icon name='circle' className='flex-shrink-0' style={{ color: addOpacity(accentColor, 0.5) }} size={iconSize} />
      );
    case 'ongoing':
    default:
      return <Spinner size='sm' className='flex-shrink-0' style={{ color: accentColor }} />;
  }
};

import React from 'react';
import { FaCheckCircle, FaCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa';

import { addOpacity } from '../../utils/format';

interface TaskStatusIconProps {
  status: 'ongoing' | 'done' | 'failed' | 'stopped';
  accentColor: string;
}

export const TaskStatusIcon: React.FC<TaskStatusIconProps> = ({ status, accentColor }) => {
  const iconSize = 14;

  switch (status) {
    case 'done':
      return <FaCheckCircle className='flex-shrink-0' style={{ color: accentColor }} size={iconSize} />;
    case 'failed':
      return (
        <FaExclamationCircle
          className='flex-shrink-0'
          style={{ color: addOpacity(accentColor, 0.75) }}
          size={iconSize}
        />
      );
    case 'stopped':
      return <FaCircle className='flex-shrink-0' style={{ color: addOpacity(accentColor, 0.5) }} size={iconSize} />;
    case 'ongoing':
    default:
      return <FaSpinner className='flex-shrink-0 animate-spin' style={{ color: accentColor }} size={iconSize} />;
  }
};

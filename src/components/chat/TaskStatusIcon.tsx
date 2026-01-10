import React from 'react';
import { FaCheckCircle, FaCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa';

interface TaskStatusIconProps {
  status: 'ongoing' | 'done' | 'failed' | 'stopped';
  accentColor: string;
}

export const TaskStatusIcon: React.FC<TaskStatusIconProps> = ({ status, accentColor }) => {
  const iconSize = 14;

  switch (status) {
    case 'done':
      return (
        <FaCheckCircle
          className='flex-shrink-0'
          style={{ color: '#10b981' }} // Green
          size={iconSize}
        />
      );
    case 'failed':
      return (
        <FaExclamationCircle
          className='flex-shrink-0'
          style={{ color: '#ef4444' }} // Red
          size={iconSize}
        />
      );
    case 'stopped':
      return (
        <FaCircle
          className='flex-shrink-0'
          style={{ color: '#eab308' }} // Yellow
          size={iconSize}
        />
      );
    case 'ongoing':
    default:
      return <FaSpinner className='flex-shrink-0 animate-spin' style={{ color: accentColor }} size={iconSize} />;
  }
};

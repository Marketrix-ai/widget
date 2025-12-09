import React from 'react';
import { FaSpinner } from 'react-icons/fa';

import { addOpacity } from '../../utils/format';

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
    <div className='flex items-center gap-1.5 py-0.5'>
      {/* Spinner icon */}
      <FaSpinner
        className='flex-shrink-0 animate-spin'
        style={{ color: accentColor || addOpacity(textColor, 0.5) }}
        size={12}
      />
      {/* State text */}
      <span
        className='text-[10px] font-inter font-normal'
        style={{ color: addOpacity(textColor, 0.5) }}
      >
        {customText || (isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking')}
      </span>
    </div>
  );
};

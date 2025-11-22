import React from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';

import { addOpacity } from '../../utils/colorUtils';

interface ProgressLineProps {
  line: string;
  isWaitingForUser: boolean;
  accentColor: string;
  textColor: string;
}

export const ProgressLine: React.FC<ProgressLineProps> = ({
  line,
  isWaitingForUser,
  accentColor,
  textColor,
}) => {
  const trimmedLine = line.trim();
  const isCompleted = trimmedLine.startsWith('●✓') || trimmedLine.startsWith('✓');
  const isPending = trimmedLine.startsWith('○') && !isCompleted;

  // Extract text after the status indicator
  const text = trimmedLine
    .replace(/^●✓\s*/, '')
    .replace(/^○\s*/, '')
    .replace(/^●\s*/, '')
    .replace(/^✓\s*/, '')
    .replace(/\s*✗\s*\([^)]*\)$/, '')
    .trim();

  return (
    <div className='flex items-start gap-2'>
      {isCompleted ? (
        <FaCheckCircle
          className='flex-shrink-0 mt-0.5'
          style={{ color: accentColor || '#10b981' }}
          size={16}
        />
      ) : isPending ? (
        isWaitingForUser ? (
          <div
            className='flex-shrink-0 mt-0.5 spinner-container'
            style={{
              width: '16px',
              height: '16px',
              position: 'relative',
            }}
          >
            <div
              className='spinner'
              style={{
                width: '16px',
                height: '16px',
                border: `2px solid ${addOpacity(textColor, 0.2)}`,
                borderTop: `2px solid ${accentColor || '#10b981'}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <FaCircle
            className='flex-shrink-0 mt-0.5'
            style={{ color: addOpacity(textColor, 0.5) }}
            size={16}
          />
        )
      ) : null}
      <span className='flex-1 whitespace-pre-wrap text-xs font-inter font-medium leading-tight'>
        {text}
      </span>
    </div>
  );
};

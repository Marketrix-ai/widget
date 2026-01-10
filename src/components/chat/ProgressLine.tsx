import React from 'react';
import { FaBan, FaCheckCircle, FaCircle, FaSpinner, FaTimesCircle } from 'react-icons/fa';

import { addOpacity } from '../../utils/format';

interface ProgressLineProps {
  content: string;
  status?: 'running' | 'completed' | 'failed' | 'canceled' | 'pending';
  isWaitingForUser: boolean;
  accentColor: string;
  textColor: string;
  hideIcon?: boolean;
  textStyle?: 'default' | 'muted';
}

export const ProgressLine: React.FC<ProgressLineProps> = ({
  content,
  status = 'pending',
  isWaitingForUser,
  accentColor,
  textColor,
  hideIcon = false,
  textStyle = 'default',
}) => {
  // Normalize status for display
  // Legacy 'pending' maps to 'running' visually if we want spinner,
  // but originally it was just a circle.
  // If status is 'running', show spinner.
  // If status is 'pending' (legacy), show circle.

  const renderIcon = () => {
    switch (status) {
      case 'completed':
        return <FaCheckCircle className='flex-shrink-0 mt-0.5' style={{ color: accentColor || '#10b981' }} size={16} />;
      case 'failed':
        return (
          <FaTimesCircle
            className='flex-shrink-0 mt-0.5'
            style={{ color: '#ef4444' }} // Red for error
            size={16}
          />
        );
      case 'canceled':
        return <FaBan className='flex-shrink-0 mt-0.5' style={{ color: addOpacity(textColor, 0.5) }} size={16} />;
      case 'running':
        // If waiting for user, we might want a different icon or just spinner?
        // The original code had specific logic for waiting for user.
        if (isWaitingForUser) {
          return (
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
          );
        }
        // Standard running spinner
        return (
          <FaSpinner
            className='flex-shrink-0 mt-0.5 animate-spin'
            style={{ color: accentColor || '#10b981' }}
            size={16}
          />
        );
      case 'pending':
      default:
        // Static circle for pending/queued
        return <FaCircle className='flex-shrink-0 mt-0.5' style={{ color: addOpacity(textColor, 0.5) }} size={16} />;
    }
  };

  return (
    <div className='flex items-start gap-2'>
      {!hideIcon && renderIcon()}
      <span
        className='flex-1 whitespace-pre-wrap text-xs font-inter font-medium leading-tight'
        style={{
          color: textStyle === 'muted' ? addOpacity(textColor, 0.5) : textColor,
        }}
      >
        {content}
      </span>
    </div>
  );
};

import React from 'react';

import { LAYER_TOKENS } from '../../design-system/layers';
import { Button } from '../base/Button';

interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
  /** Optional retry for transient failures (explicit recovery per plan 7.4) */
  onRetry?: () => void;
  position?: 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right';
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onClose, onRetry, position = 'bottom_left' }) => {
  const positionStyle =
    position === 'bottom_left' || position === 'top_left' || !position ? { left: '0' } : { right: '0' };
  const verticalStyle = position.includes('top') ? { top: '20px' } : { bottom: '90px' };

  return (
    <div
      className='fixed max-w-sm'
      style={{
        zIndex: LAYER_TOKENS.toast + 10,
        ...verticalStyle,
        ...positionStyle,
      }}
    >
      <div className='bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-sm flex-1'>{error}</span>
          {onRetry && (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => {
                onRetry();
                onClose();
              }}
              className='text-white border-white/50 hover:bg-red-600'
              aria-label='Retry'
            >
              Retry
            </Button>
          )}
          <Button
            type='button'
            variant='ghost'
            onClick={onClose}
            className='ml-4 text-white hover:text-red-100 min-w-0 p-1'
            aria-label='Close error'
          >
            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};

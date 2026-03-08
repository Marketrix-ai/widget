import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { LAYER_TOKENS } from '../../design-system/layers';

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
      className='fixed'
      style={{
        zIndex: LAYER_TOKENS.toast + 10,
        ...verticalStyle,
        ...positionStyle,
        maxWidth: '420px',
      }}
    >
      <div
        className='flex items-center gap-2.5 rounded-full shadow-lg'
        style={{
          padding: '8px 12px 8px 8px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
        }}
      >
        {/* Marketrix Logo */}
        <img
          src={MarketrixIcon}
          alt=''
          className='flex-shrink-0 rounded-full'
          style={{ width: '28px', height: '28px' }}
        />

        {/* Error Message */}
        <span
          className='text-red-700 font-medium flex-1 min-w-0'
          style={{
            fontSize: '13px',
            whiteSpace: onRetry ? 'normal' : 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {error}
        </span>

        {onRetry && (
          <button
            type='button'
            onClick={() => {
              onRetry();
              onClose();
            }}
            className='flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-red-700 transition-colors hover:text-red-800'
            style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
            }}
            aria-label='Retry'
          >
            Retry
          </button>
        )}

        <button
          type='button'
          onClick={onClose}
          className='flex-shrink-0 text-red-400 hover:text-red-600 flex items-center justify-center rounded-full'
          style={{ width: '20px', height: '20px', padding: '2px' }}
          aria-label='Close error'
        >
          <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
            <path
              d='M9 3L3 9M3 3l6 6'
              stroke='currentColor'
              strokeWidth='1.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

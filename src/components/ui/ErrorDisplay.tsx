import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';

interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onClose }) => {
  return (
    <div
      className='fixed'
      style={{
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '420px',
        zIndex: 2147483030,
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
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {error}
        </span>

        {/* Close Button */}
        <button
          onClick={onClose}
          className='flex-shrink-0 text-red-400 hover:text-red-600 flex items-center justify-center rounded-full'
          style={{ width: '20px', height: '20px', padding: '2px' }}
          aria-label='Dismiss'
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

import React from 'react';

interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
  position?: 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right';
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onClose, position = 'bottom_left' }) => {
  const positionStyle =
    position === 'bottom_left' || position === 'top_left' || !position ? { left: '0' } : { right: '0' };
  const verticalStyle = position.includes('top') ? { top: '20px' } : { bottom: '90px' };

  return (
    <div
      className='fixed max-w-sm'
      style={{
        zIndex: 2147483030,
        ...verticalStyle,
        ...positionStyle,
      }}
    >
      <div className='bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg'>
        <div className='flex items-center justify-between'>
          <span className='text-sm'>{error}</span>
          <button onClick={onClose} className='ml-4 text-white hover:text-red-100' aria-label='Close error'>
            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

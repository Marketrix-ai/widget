import React, { useCallback, useEffect, useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';

interface GreetingToastProps {
  greeting: string;
  body?: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export const GreetingToast: React.FC<GreetingToastProps> = ({ greeting, body, onClose, autoCloseMs = 8000 }) => {
  const [isExiting, setIsExiting] = useState(false);

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(dismiss, autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, dismiss]);

  return (
    <div
      className='fixed'
      style={{
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '420px',
        zIndex: 2147483030,
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        animation: isExiting ? 'none' : 'fadeIn 0.3s ease-out',
      }}
    >
      <div
        className='flex items-center gap-2.5 rounded-full shadow-lg cursor-pointer'
        style={{
          padding: '8px 12px 8px 8px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
        }}
        onClick={dismiss}
      >
        <img
          src={MarketrixIcon}
          alt=''
          className='flex-shrink-0 rounded-full'
          style={{ width: '28px', height: '28px' }}
        />

        <div className='flex-1 min-w-0'>
          <span
            className='font-medium block'
            style={{
              fontSize: '13px',
              color: '#0c4a6e',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {greeting}
          </span>
          {body && (
            <span
              className='block'
              style={{
                fontSize: '12px',
                color: '#0369a1',
                opacity: 0.7,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {body}
            </span>
          )}
        </div>

        <button
          onClick={e => {
            e.stopPropagation();
            dismiss();
          }}
          className='flex-shrink-0 flex items-center justify-center rounded-full'
          style={{ width: '20px', height: '20px', padding: '2px', color: '#7dd3fc' }}
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

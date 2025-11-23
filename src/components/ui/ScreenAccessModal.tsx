import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.png';

interface ScreenAccessModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
  onClose: () => void;
}

export const ScreenAccessModal: React.FC<ScreenAccessModalProps> = ({
  isOpen,
  onAllow,
  onDeny,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className='absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg'
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className='max-w-sm mx-4'>
        {/* Message-style container */}
        <div className='flex items-start gap-1.5 flex-row mb-3'>
          {/* Agent Logo */}
          <div className='flex-shrink-0 w-8 h-8'>
            <img src={MarketrixIcon} alt='Marketrix AI' className='w-8 h-8 object-cover' />
          </div>

          {/* Message bubble */}
          <div className='flex flex-col flex-1 px-2.5 py-2 rounded-r-lg rounded-tl-lg rounded-bl-lg shadow-sm border bg-white text-black border-gray-200'>
            <div className='text-xs font-inter font-medium leading-tight whitespace-pre-wrap break-words'>
              Can I take a look at your screen?
            </div>
          </div>
        </div>

        {/* Action buttons - styled like Show/Tell/Do buttons */}
        <div className='flex gap-2 justify-center'>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAllow();
            }}
            className='flex items-center justify-center text-sm font-medium transition-all duration-200 bg-purple-600 text-white shadow-lg border-2 border-transparent'
            style={{
              width: '65px',
              height: '26px',
              borderRadius: '22px',
            }}
          >
            <span className='text-xs font-medium'>Yes</span>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeny();
            }}
            className='flex items-center justify-center text-sm font-medium transition-all duration-200 bg-purple-100 text-black hover:bg-purple-200 border border-purple-200'
            style={{
              width: '65px',
              height: '26px',
              borderRadius: '22px',
            }}
          >
            <span className='text-xs font-medium'>No</span>
          </button>
        </div>
      </div>
    </div>
  );
};

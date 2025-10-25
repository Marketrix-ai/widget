import React from 'react';

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
      className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]'
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className='bg-white rounded-lg p-3 max-w-md mx-4 shadow-xl'>
        <div className='text-center'>
          <h3 className='text-lg font-semibold text-gray-900 mb-3'>
            Can I take a look at your screen?
          </h3>

          <p className='text-gray-600 mb-6 text-sm leading-relaxed'>
            By allowing screen access, Marketrix can understand your current context to guide you
            better and complete tasks on your behalf.
          </p>

          <div className='flex gap-3 justify-center'>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAllow();
              }}
              className='px-5 py-1 bg-[#E7DDFF] text-[#6941C6] rounded-full transition-all duration-200 text-sm font-medium'
            >
              Yes
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeny();
              }}
              className='px-6  py-1 bg-[#E7DDFF] text-[#6941C6] rounded-full hover:bg-gray-50 transition-all duration-200 text-sm font-medium'
            >
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

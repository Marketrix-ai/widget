import React from 'react';

import { Button } from '../base/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../base/Dialog';
import { Flex } from '../base/Flex';

interface ScreenAccessModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
  onClose: () => void;
}

export const ScreenAccessModal: React.FC<ScreenAccessModalProps> = ({ isOpen, onAllow, onDeny, onClose }) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className='bg-white rounded-lg p-3 max-w-md mx-4 shadow-xl text-center'>
        <DialogTitle className='text-lg font-semibold text-gray-900 mb-3'>
          Can I take a look at your screen?
        </DialogTitle>
        <DialogDescription className='text-gray-600 mb-6 text-sm leading-relaxed'>
          By allowing screen access, Marketrix can understand your current context to guide you better and complete
          tasks on your behalf.
        </DialogDescription>
        <Flex className='gap-3 justify-center'>
          <Button
            type='button'
            variant='primary'
            size='sm'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onAllow();
            }}
            className='px-5 py-1 rounded-full text-sm font-medium'
            style={{ backgroundColor: '#111827', color: '#fff', border: 'none' }}
          >
            Yes
          </Button>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onDeny();
            }}
            className='px-6 py-1 rounded-full text-sm font-medium border border-gray-200'
            style={{ backgroundColor: '#f3f4f6', color: '#1f2937' }}
          >
            No
          </Button>
        </Flex>
      </DialogContent>
    </Dialog>
  );
};

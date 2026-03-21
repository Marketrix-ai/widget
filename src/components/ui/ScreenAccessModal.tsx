import React from 'react';

import { WidgetDialog } from '../blocks/WidgetDialog';

interface ScreenAccessModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
  onClose: () => void;
}

export const ScreenAccessModal: React.FC<ScreenAccessModalProps> = ({ isOpen, onAllow, onDeny: _onDeny, onClose }) => {
  return (
    <WidgetDialog
      variant='confirm'
      open={isOpen}
      onClose={onClose}
      title='Can I take a look at your screen?'
      description='By allowing screen access, Marketrix can understand your current context to guide you better and complete tasks on your behalf.'
      onConfirm={onAllow}
      confirmLabel='Yes'
      cancelLabel='No'
    />
  );
};

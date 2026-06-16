import React from 'react';

import { Button } from '../base/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../base/Dialog';
import { Flex } from '../base/Flex';

export interface WidgetDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const WidgetDialog: React.FC<WidgetDialogProps> = ({
  open,
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent variant='confirm'>
        <DialogTitle variant='confirm'>{title}</DialogTitle>
        {description != null && <DialogDescription variant='confirm'>{description}</DialogDescription>}
        <Flex gap='md' justify='end'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            shape='pill'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            type='button'
            variant='primary'
            size='sm'
            shape='pill'
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onConfirm?.();
            }}
          >
            {confirmLabel}
          </Button>
        </Flex>
      </DialogContent>
    </Dialog>
  );
};

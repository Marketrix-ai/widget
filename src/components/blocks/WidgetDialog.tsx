import { Dialog } from '@base-ui/react/dialog';
import React from 'react';

import { usePortalContainer } from '../../context/WidgetProviders';
import { getElevationStyle } from '../../design-system/component-tokens';
import { LAYER_TOKENS } from '../../design-system/layers';
import { Button } from '../base/Button';
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
  const portalContainer = usePortalContainer();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, eventDetails) => {
        if (!next && eventDetails.reason !== 'none') onClose();
      }}
    >
      <Dialog.Portal container={portalContainer}>
        <Dialog.Backdrop className='mtx-dialog-backdrop' style={{ zIndex: LAYER_TOKENS.dialog }} />
        <Dialog.Popup
          className='mtx-dialog-popup'
          style={{ ...getElevationStyle('panel'), zIndex: LAYER_TOKENS.dialog }}
        >
          <Dialog.Title className='mtx-dialog-title'>{title}</Dialog.Title>
          {description != null && (
            <Dialog.Description className='mtx-dialog-description'>{description}</Dialog.Description>
          )}
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

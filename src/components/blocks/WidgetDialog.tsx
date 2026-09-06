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
        <Dialog.Backdrop
          className='fixed inset-0 bg-black/20 animate-dialog-overlay-in'
          style={{ zIndex: LAYER_TOKENS.dialog }}
        />
        <Dialog.Popup
          className='fixed top-1/2 left-1/2 flex max-h-[85vh] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto rounded-lg bg-card p-4 animate-dialog-content-in'
          style={{ ...getElevationStyle('panel'), zIndex: LAYER_TOKENS.dialog }}
        >
          <Dialog.Title className='mb-1 text-base font-semibold text-foreground'>{title}</Dialog.Title>
          {description != null && (
            <Dialog.Description className='mb-4 text-sm leading-relaxed text-foreground-muted'>
              {description}
            </Dialog.Description>
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

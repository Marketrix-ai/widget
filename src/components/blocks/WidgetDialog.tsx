/**
 * The widget's one modal: a Base UI dialog, open while rendered, with a title, description and a
 * cancel/confirm button pair, skinned by `index.css`'s `mtx-dialog-*` rules.
 *
 * `WidgetDialog` renders into the portal container published by the widget root rather than the default
 * target, so it picks up the tenant's theme tokens instead of falling back to the hardcoded palette.
 * `finalFocusRef` is passed explicitly because Base UI's own focus restore breaks inside a closed shadow
 * root and would otherwise hand focus back to the host page on close.
 */
import { Dialog } from '@base-ui/react/dialog';
import React from 'react';

import { usePortalContainer } from '../../context/WidgetProviders';
import { getElevationStyle, LAYER_TOKENS } from '../../design-system/component-tokens';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';

interface WidgetDialogProps {
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel: string;
  finalFocusRef: React.RefObject<HTMLElement | null>;
}

export const WidgetDialog: React.FC<WidgetDialogProps> = ({
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel,
  cancelLabel,
  finalFocusRef,
}) => {
  const portalContainer = usePortalContainer();

  return (
    <Dialog.Root
      open
      onOpenChange={(next, eventDetails) => {
        if (!next && eventDetails.reason !== 'none') onClose();
      }}
    >
      <Dialog.Portal container={portalContainer}>
        <Dialog.Backdrop className='mtx-dialog-backdrop' style={{ zIndex: LAYER_TOKENS.dialog }} />
        <Dialog.Popup
          className='mtx-dialog-popup'
          finalFocus={finalFocusRef}
          style={{ ...getElevationStyle('panel'), zIndex: LAYER_TOKENS.dialog }}
        >
          <Dialog.Title className='mtx-dialog-title'>{title}</Dialog.Title>
          <Dialog.Description className='mtx-dialog-description'>{description}</Dialog.Description>
          <Flex gap='md' justify='end'>
            {(
              [
                ['secondary', cancelLabel, onClose],
                ['primary', confirmLabel, onConfirm],
              ] as const
            ).map(([variant, label, act]) => (
              <Button key={variant} variant={variant} size='sm' shape='pill' onClick={act}>
                {label}
              </Button>
            ))}
          </Flex>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

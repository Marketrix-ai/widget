/**
 * The widget's one modal: the Base UI dialog asking the visitor for screen access, open while rendered,
 * skinned by `index.css`'s `mtx-dialog-*` rules.
 *
 * `ScreenAccessDialog` renders into the portal container published by the widget root rather than the default
 * target, so it picks up the tenant's theme tokens instead of falling back to the hardcoded palette.
 * `finalFocusRef` is passed explicitly because Base UI's own focus restore breaks inside a closed shadow
 * root and would otherwise hand focus back to the host page on close.
 */
import { Dialog } from '@base-ui/react/dialog';
import React from 'react';

import { usePortalContainer } from '../../context/WidgetProviders';
import { getElevationStyle, LAYER_TOKENS } from '../../design-system/component-tokens';
import { SCREEN_ACCESS_DETAIL, SCREEN_ACCESS_PROMPT } from '../../utils/chat';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';

interface ScreenAccessDialogProps {
  onClose: () => void;
  onConfirm: () => void;
  finalFocusRef: React.RefObject<HTMLElement | null>;
}

export const ScreenAccessDialog: React.FC<ScreenAccessDialogProps> = ({ onClose, onConfirm, finalFocusRef }) => {
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
          <Dialog.Title className='mtx-dialog-title'>{SCREEN_ACCESS_PROMPT}</Dialog.Title>
          <Dialog.Description className='mtx-dialog-description'>{SCREEN_ACCESS_DETAIL}</Dialog.Description>
          <Flex gap='md' justify='end'>
            <Button variant='secondary' size='sm' shape='pill' onClick={onClose}>
              No
            </Button>
            <Button variant='primary' size='sm' shape='pill' onClick={onConfirm}>
              Yes
            </Button>
          </Flex>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

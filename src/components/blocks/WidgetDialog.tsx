/**
 * The widget's one modal — a Base UI dialog with a title, optional description and a cancel/confirm
 * button pair, skinned by the `mtx-dialog-*` rules in `index.css`.
 *
 * `WidgetDialogProps` carries `open`/`onClose`, the copy (`title`, `description`, `confirmLabel`,
 * `cancelLabel`), an optional `onConfirm`, and `finalFocusRef` naming where focus lands on close.
 * `WidgetDialog` renders the backdrop and popup into the portal container published by the widget root.
 *
 * The portal target comes from `usePortalContainer()` rather than defaulting to the shadow root: the
 * widget root element carries every tenant token as an inline style, so anything portaled beside it
 * renders in `index.css`'s hardcoded fallback palette instead of the tenant's theme.
 *
 * `finalFocus` is named explicitly because Base UI's default focus restore is broken inside a closed
 * shadow root: it descends `element.shadowRoot.activeElement`, which is null for a CLOSED root, so it
 * records the shadow HOST and hands focus to a host-page element on close.
 *
 * Base UI stamps `reason === 'none'` on an open-state change it makes itself with no originating event
 * (a popup whose active trigger unmounted); `onOpenChange` skips those and reports only real closes.
 */
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
  finalFocusRef?: React.RefObject<HTMLElement | null>;
}

export const WidgetDialog: React.FC<WidgetDialogProps> = ({
  open,
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  finalFocusRef,
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
          finalFocus={finalFocusRef}
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

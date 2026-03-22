import React from 'react';

import { Badge } from '../base/Badge';
import { Button } from '../base/Button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../base/Dialog';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

export interface WidgetDialogRow {
  label: string;
  value: string;
  copyable?: boolean;
}

export interface WidgetDialogStatus {
  label: string;
  color: 'green' | 'blue' | 'yellow' | 'gray';
}

export interface WidgetDialogProps {
  variant: 'confirm' | 'info';
  open: boolean;
  onClose: () => void;
  title: string;
  // confirm variant
  description?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  // info variant
  rows?: WidgetDialogRow[];
  status?: WidgetDialogStatus;
}

const statusToneMap: Record<WidgetDialogStatus['color'], 'success' | 'primary' | 'warning' | 'muted'> = {
  green: 'success',
  blue: 'primary',
  yellow: 'warning',
  gray: 'muted',
};

export const WidgetDialog: React.FC<WidgetDialogProps> = ({
  variant,
  open,
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  rows = [],
  status,
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      {variant === 'confirm' ? (
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
      ) : (
        <DialogContent variant='info'>
          {/* Header */}
          <Flex align='center' justify='between' paddingX='lg' paddingY='sm' border='bottom'>
            <DialogTitle variant='info'>{title}</DialogTitle>
            <DialogClose variant='info' aria-label='Close'>
              <Icon name='x' size={12} />
            </DialogClose>
          </Flex>

          {/* Rows */}
          <Stack paddingX='lg' paddingY='sm'>
            {rows.map(row => (
              <Flex key={row.label} align='center' justify='between' paddingY='2xs'>
                <Text as='span' size='xs' variant='muted'>
                  {row.label}
                </Text>
                <Flex align='center' gap='2xs'>
                  <Text as='code' code size='xs' variant='muted' truncate style={{ maxWidth: '120px' }}>
                    {row.value || 'N/A'}
                  </Text>
                  {row.copyable === true && row.value && (
                    <Button type='button' variant='inline' size='sm' onClick={() => copyToClipboard(row.value)}>
                      Copy
                    </Button>
                  )}
                </Flex>
              </Flex>
            ))}

            {/* Status badge */}
            {status != null && (
              <Flex align='center' justify='between' paddingY='2xs'>
                <Text as='span' size='xs' variant='muted'>
                  Status
                </Text>
                <Badge variant='status' tone={statusToneMap[status.color]}>
                  {status.label}
                </Badge>
              </Flex>
            )}
          </Stack>
        </DialogContent>
      )}
    </Dialog>
  );
};

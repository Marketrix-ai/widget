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

const statusColorMap: Record<WidgetDialogStatus['color'], string> = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  gray: 'bg-gray-100 text-gray-600',
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
        <DialogContent className='bg-white rounded-lg p-4 max-w-sm shadow-xl'>
          <DialogTitle className='text-base font-semibold text-gray-900 mb-1'>{title}</DialogTitle>
          {description != null && (
            <DialogDescription className='text-sm text-gray-600 mb-4 leading-relaxed'>{description}</DialogDescription>
          )}
          <Flex className='gap-2 justify-end'>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className='px-4 py-1.5 rounded-full text-sm font-medium border border-gray-200'
            >
              {cancelLabel}
            </Button>
            <Button
              type='button'
              variant='primary'
              size='sm'
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onConfirm?.();
              }}
              className='px-4 py-1.5 rounded-full text-sm font-medium'
            >
              {confirmLabel}
            </Button>
          </Flex>
        </DialogContent>
      ) : (
        <DialogContent className='bg-white rounded-md shadow-lg border border-gray-200 w-64 p-0'>
          {/* Header */}
          <Flex className='items-center justify-between px-3 py-1.5 border-b border-gray-100'>
            <DialogTitle className='text-[11px] font-semibold text-gray-700 flex-1 text-center mb-0'>
              {title}
            </DialogTitle>
            <DialogClose className='text-gray-400 hover:text-gray-600 -mr-1 static w-auto h-auto' aria-label='Close'>
              <Icon name='x' size={12} />
            </DialogClose>
          </Flex>

          {/* Rows */}
          <Stack className='px-3 py-1.5'>
            {rows.map(row => (
              <Flex key={row.label} className='items-center justify-between py-[3px]'>
                <Text as='span' className='text-[10px] text-gray-500'>
                  {row.label}
                </Text>
                <Flex className='items-center gap-1'>
                  <Text
                    as='code'
                    className='text-[9px] text-gray-600 bg-gray-50 px-1 py-0.5 rounded max-w-[120px] truncate'
                  >
                    {row.value || 'N/A'}
                  </Text>
                  {row.copyable === true && row.value && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => copyToClipboard(row.value)}
                      className='text-[9px] text-blue-500 hover:text-blue-600 min-w-0 p-0 h-auto'
                    >
                      Copy
                    </Button>
                  )}
                </Flex>
              </Flex>
            ))}

            {/* Status badge */}
            {status != null && (
              <Flex className='items-center justify-between py-[3px]'>
                <Text as='span' className='text-[10px] text-gray-500'>
                  Status
                </Text>
                <Badge variant='status' className={statusColorMap[status.color]}>
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

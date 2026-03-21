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
  green: 'bg-success/15 text-success',
  blue: 'bg-chart-1/15 text-chart-1',
  yellow: 'bg-warning/15 text-warning',
  gray: 'bg-muted text-muted-foreground',
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
        <DialogContent className='bg-card rounded-lg p-4 max-w-sm shadow-xl'>
          <DialogTitle className='text-base font-semibold text-foreground mb-1'>{title}</DialogTitle>
          {description != null && (
            <DialogDescription className='text-sm text-muted-foreground mb-4 leading-relaxed'>
              {description}
            </DialogDescription>
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
              className='px-4 py-1.5 rounded-full text-sm font-medium border border-border'
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
        <DialogContent className='bg-card rounded-md shadow-lg border border-border w-64 p-0'>
          {/* Header */}
          <Flex className='items-center justify-between px-3 py-1.5 border-b border-border'>
            <DialogTitle className='text-xs font-semibold text-foreground flex-1 text-center mb-0'>{title}</DialogTitle>
            <DialogClose
              className='text-muted-foreground hover:text-foreground -mr-1 static w-auto h-auto'
              aria-label='Close'
            >
              <Icon name='x' size={12} />
            </DialogClose>
          </Flex>

          {/* Rows */}
          <Stack className='px-3 py-1.5'>
            {rows.map(row => (
              <Flex key={row.label} className='items-center justify-between py-[3px]'>
                <Text as='span' className='text-xs text-muted-foreground'>
                  {row.label}
                </Text>
                <Flex className='items-center gap-1'>
                  <Text
                    as='code'
                    className='text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded max-w-[120px] truncate'
                  >
                    {row.value || 'N/A'}
                  </Text>
                  {row.copyable === true && row.value && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => copyToClipboard(row.value)}
                      className='text-xs text-primary hover:text-primary min-w-0 p-0 h-auto'
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
                <Text as='span' className='text-xs text-muted-foreground'>
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

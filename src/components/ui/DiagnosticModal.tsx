import React from 'react';

import { Button } from '../base/Button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../base/Dialog';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosticData: {
    chatId: string | null;
    streamEndpoint: string | null;
    connectionStatus: string;
    applicationId: number | undefined; // mtxApp
    agentId: number | undefined; // mtxAgent
    version: string;
    build: string;
  };
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({ isOpen, onClose, diagnosticData }) => {
  const copyToClipboard = (text: string | null | undefined) => {
    if (!text) return;
    navigator.clipboard.writeText(text.toString());
  };

  const statusColor =
    diagnosticData.connectionStatus === 'registered'
      ? 'bg-green-100 text-green-700'
      : diagnosticData.connectionStatus === 'connected'
        ? 'bg-blue-100 text-blue-700'
        : diagnosticData.connectionStatus === 'connecting'
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-600';

  const rows: { label: string; value: string | null | undefined; copyable?: boolean }[] = [
    { label: 'Chat ID', value: diagnosticData.chatId, copyable: true },
    { label: 'Stream Endpoint', value: diagnosticData.streamEndpoint, copyable: true },
    { label: 'Application ID', value: diagnosticData.applicationId?.toString(), copyable: true },
    { label: 'Agent ID', value: diagnosticData.agentId?.toString(), copyable: true },
  ];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className='bg-white rounded-md shadow-lg border border-gray-200 w-64 p-0'>
        {/* Header */}
        <Flex className='items-center justify-between px-3 py-1.5 border-b border-gray-100'>
          <DialogTitle className='text-[11px] font-semibold text-gray-700 flex-1 text-center mb-0'>
            Widget v{diagnosticData.version} (
            {diagnosticData.build === 'dev' ? 'dev' : diagnosticData.build.slice(0, 7)})
          </DialogTitle>
          <DialogClose
            className='text-gray-400 hover:text-gray-600 -mr-1 static w-auto h-auto'
            aria-label='Close diagnostic'
          >
            <Icon name='x' size={12} />
          </DialogClose>
        </Flex>

        {/* Content */}
        <Stack className='px-3 py-1.5'>
          {rows.map(row => (
            <Flex key={row.label} className='items-center justify-between py-[3px]'>
              <Text as='span' className='text-[10px] text-gray-500'>{row.label}</Text>
              <Flex className='items-center gap-1'>
                <Text as='code' className='text-[9px] text-gray-600 bg-gray-50 px-1 py-0.5 rounded max-w-[120px] truncate'>
                  {row.value || 'N/A'}
                </Text>
                {row.copyable && row.value && (
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

          {/* Connection Status */}
          <Flex className='items-center justify-between py-[3px]'>
            <Text as='span' className='text-[10px] text-gray-500'>Status</Text>
            <Text as='span' className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${statusColor}`}>
              {diagnosticData.connectionStatus}
            </Text>
          </Flex>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

import React from 'react';
import { FiX } from 'react-icons/fi';

import { LAYER_TOKENS } from '../../design-system/layers';
import { Button } from '../base/Button';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosticData: {
    chatId: string | null;
    tabId: string | null;
    streamEndpoint: string | null;
    connectionStatus: string;
    connectionId: number | undefined; // mtxApp
    agentId: number | undefined; // mtxAgent
    version: string;
    build: string;
  };
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({ isOpen, onClose, diagnosticData }) => {
  if (!isOpen) return null;

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
    { label: 'Tab ID', value: diagnosticData.tabId, copyable: true },
    { label: 'Stream Endpoint', value: diagnosticData.streamEndpoint, copyable: true },
    { label: 'Connection ID', value: diagnosticData.connectionId?.toString(), copyable: true },
    { label: 'Agent ID', value: diagnosticData.agentId?.toString(), copyable: true },
  ];

  return (
    <div
      className='fixed inset-0 flex items-center justify-center'
      style={{ zIndex: LAYER_TOKENS.modal + 10 }}
      onClick={onClose}
    >
      <div className='bg-white rounded-md shadow-lg border border-gray-200 w-64' onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className='flex items-center justify-between px-3 py-1.5 border-b border-gray-100'>
          <span className='text-[11px] font-semibold text-gray-700 flex-1 text-center'>
            Widget v{diagnosticData.version} (
            {diagnosticData.build === 'dev' ? 'dev' : diagnosticData.build.slice(0, 7)})
          </span>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 -mr-1 min-w-0 p-0'
            aria-label='Close diagnostic'
          >
            <FiX className='w-3 h-3' />
          </Button>
        </div>

        {/* Content */}
        <div className='px-3 py-1.5'>
          {rows.map(row => (
            <div key={row.label} className='flex items-center justify-between py-[3px]'>
              <span className='text-[10px] text-gray-500'>{row.label}</span>
              <div className='flex items-center gap-1'>
                <code className='text-[9px] text-gray-600 bg-gray-50 px-1 py-0.5 rounded max-w-[120px] truncate'>
                  {row.value || 'N/A'}
                </code>
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
              </div>
            </div>
          ))}

          {/* Connection Status */}
          <div className='flex items-center justify-between py-[3px]'>
            <span className='text-[10px] text-gray-500'>Status</span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${statusColor}`}>
              {diagnosticData.connectionStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

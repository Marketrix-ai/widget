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
    websocketEndpoint: string | null;
    connectionStatus: string;
    connectionId: number | undefined; // mtxApp
    agentId: number | undefined; // mtxAgent
  };
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({ isOpen, onClose, diagnosticData }) => {
  if (!isOpen) return null;

  const copyToClipboard = (text: string | null | undefined) => {
    if (!text) return;
    navigator.clipboard.writeText(text.toString());
  };

  return (
    <div
      className='fixed inset-0 bg-black/50 flex items-center justify-center p-4'
      style={{ zIndex: LAYER_TOKENS.modal + 10 }}
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='bg-gradient-to-r from-gray-900 to-gray-700 px-6 py-4 text-white relative overflow-hidden flex-shrink-0 rounded-t-lg'>
          <div className='relative z-10 flex items-center justify-between'>
            <div>
              <h2 className='text-base font-semibold text-white'>Diagnostic Information</h2>
              <p className='text-xs text-gray-200 mt-0.5'>Widget connection details</p>
            </div>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={onClose}
              className='text-white/80 hover:text-white min-w-0 p-1'
              aria-label='Close diagnostic'
            >
              <FiX className='w-5 h-5' />
            </Button>
          </div>
        </div>

        {/* Content - scrollable when needed */}
        <div className='px-6 py-5 space-y-4 flex-1 min-h-0 overflow-y-auto'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between py-2 border-b border-gray-200'>
              <span className='text-sm font-medium text-gray-700'>Chat ID</span>
              <div className='flex items-center gap-2'>
                <code className='text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded'>
                  {diagnosticData.chatId || 'N/A'}
                </code>
                {diagnosticData.chatId && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => copyToClipboard(diagnosticData.chatId)}
                    className='text-xs text-blue-600 hover:text-blue-700 min-w-0 p-0 h-auto'
                    title='Copy to clipboard'
                  >
                    Copy
                  </Button>
                )}
              </div>
            </div>

            <div className='flex items-center justify-between py-2 border-b border-gray-200'>
              <span className='text-sm font-medium text-gray-700'>Tab ID</span>
              <div className='flex items-center gap-2'>
                <code className='text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded'>
                  {diagnosticData.tabId || 'N/A'}
                </code>
                {diagnosticData.tabId && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => copyToClipboard(diagnosticData.tabId)}
                    className='text-xs text-blue-600 hover:text-blue-700 min-w-0 p-0 h-auto'
                    title='Copy to clipboard'
                  >
                    Copy
                  </Button>
                )}
              </div>
            </div>

            <div className='flex items-center justify-between py-2 border-b border-gray-200'>
              <span className='text-sm font-medium text-gray-700'>WebSocket Endpoint</span>
              <div className='flex items-center gap-2'>
                <code className='text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded max-w-[200px] truncate'>
                  {diagnosticData.websocketEndpoint || 'N/A'}
                </code>
                {diagnosticData.websocketEndpoint && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => copyToClipboard(diagnosticData.websocketEndpoint)}
                    className='text-xs text-blue-600 hover:text-blue-700 min-w-0 p-0 h-auto'
                    title='Copy to clipboard'
                  >
                    Copy
                  </Button>
                )}
              </div>
            </div>

            <div className='flex items-center justify-between py-2 border-b border-gray-200'>
              <span className='text-sm font-medium text-gray-700'>Connection Status</span>
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  diagnosticData.connectionStatus === 'registered'
                    ? 'bg-green-100 text-green-800'
                    : diagnosticData.connectionStatus === 'connected'
                      ? 'bg-blue-100 text-blue-800'
                      : diagnosticData.connectionStatus === 'connecting'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                }`}
              >
                {diagnosticData.connectionStatus}
              </span>
            </div>

            <div className='flex items-center justify-between py-2 border-b border-gray-200'>
              <span className='text-sm font-medium text-gray-700'>Connection ID</span>
              <div className='flex items-center gap-2'>
                <code className='text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded'>
                  {diagnosticData.connectionId || 'N/A'}
                </code>
                {diagnosticData.connectionId && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => copyToClipboard(diagnosticData.connectionId?.toString())}
                    className='text-xs text-blue-600 hover:text-blue-700 min-w-0 p-0 h-auto'
                    title='Copy to clipboard'
                  >
                    Copy
                  </Button>
                )}
              </div>
            </div>

            <div className='flex items-center justify-between py-2 border-b border-gray-200'>
              <span className='text-sm font-medium text-gray-700'>Agent ID</span>
              <div className='flex items-center gap-2'>
                <code className='text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded'>
                  {diagnosticData.agentId || 'N/A'}
                </code>
                {diagnosticData.agentId && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => copyToClipboard(diagnosticData.agentId?.toString())}
                    className='text-xs text-blue-600 hover:text-blue-700 min-w-0 p-0 h-auto'
                    title='Copy to clipboard'
                  >
                    Copy
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex justify-end items-center px-6 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-lg'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={onClose}
            className='px-3 py-1.5 text-xs font-medium'
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { FiX } from 'react-icons/fi';

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
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-[100]' onClick={onClose}>
      <div
        className='bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-white relative overflow-hidden flex-shrink-0'>
          <div className='relative z-10 flex items-center justify-between'>
            <div>
              <h2 className='text-base font-semibold text-white'>Diagnostic Information</h2>
              <p className='text-xs text-purple-100 mt-0.5'>Widget connection details</p>
            </div>
            <button onClick={onClose} className='text-white/80 hover:text-white transition-colors'>
              <FiX className='w-5 h-5' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='px-6 py-5 space-y-4'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between py-2 border-b border-gray-200'>
              <span className='text-sm font-medium text-gray-700'>Chat ID</span>
              <div className='flex items-center gap-2'>
                <code className='text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded'>
                  {diagnosticData.chatId || 'N/A'}
                </code>
                {diagnosticData.chatId && (
                  <button
                    onClick={() => copyToClipboard(diagnosticData.chatId)}
                    className='text-xs text-blue-600 hover:text-blue-700'
                    title='Copy to clipboard'
                  >
                    Copy
                  </button>
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
                  <button
                    onClick={() => copyToClipboard(diagnosticData.tabId)}
                    className='text-xs text-blue-600 hover:text-blue-700'
                    title='Copy to clipboard'
                  >
                    Copy
                  </button>
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
                  <button
                    onClick={() => copyToClipboard(diagnosticData.websocketEndpoint)}
                    className='text-xs text-blue-600 hover:text-blue-700'
                    title='Copy to clipboard'
                  >
                    Copy
                  </button>
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
                  <button
                    onClick={() => copyToClipboard(diagnosticData.connectionId?.toString())}
                    className='text-xs text-blue-600 hover:text-blue-700'
                    title='Copy to clipboard'
                  >
                    Copy
                  </button>
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
                  <button
                    onClick={() => copyToClipboard(diagnosticData.agentId?.toString())}
                    className='text-xs text-blue-600 hover:text-blue-700'
                    title='Copy to clipboard'
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex justify-end items-center px-6 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0'>
          <button
            onClick={onClose}
            className='px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

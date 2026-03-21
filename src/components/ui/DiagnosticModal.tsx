import React from 'react';

import { WidgetDialog, type WidgetDialogRow, type WidgetDialogStatus } from '../blocks/WidgetDialog';

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

function getStatusColor(status: string): WidgetDialogStatus['color'] {
  if (status === 'registered') return 'green';
  if (status === 'connected') return 'blue';
  if (status === 'connecting') return 'yellow';
  return 'gray';
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({ isOpen, onClose, diagnosticData }) => {
  const rows: WidgetDialogRow[] = [
    { label: 'Chat ID', value: diagnosticData.chatId ?? 'N/A', copyable: !!diagnosticData.chatId },
    {
      label: 'Stream Endpoint',
      value: diagnosticData.streamEndpoint ?? 'N/A',
      copyable: !!diagnosticData.streamEndpoint,
    },
    {
      label: 'Application ID',
      value: diagnosticData.applicationId?.toString() ?? 'N/A',
      copyable: !!diagnosticData.applicationId,
    },
    { label: 'Agent ID', value: diagnosticData.agentId?.toString() ?? 'N/A', copyable: !!diagnosticData.agentId },
  ];

  const status: WidgetDialogStatus = {
    label: diagnosticData.connectionStatus,
    color: getStatusColor(diagnosticData.connectionStatus),
  };

  const buildLabel = diagnosticData.build === 'dev' ? 'dev' : diagnosticData.build.slice(0, 7);

  return (
    <WidgetDialog
      variant='info'
      open={isOpen}
      onClose={onClose}
      title={`Widget v${diagnosticData.version} (${buildLabel})`}
      rows={rows}
      status={status}
    />
  );
};

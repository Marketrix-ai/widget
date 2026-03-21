import React, { useState } from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import packageJson from '../../../package.json';
import MarketrixLogo from '../../assets/marktrix-footer.png';
import type { InstructionType } from '../../sdk';
import { configManager } from '../../services/ConfigManager';
import { sessionManager } from '../../services/SessionManager';
import { StreamClient } from '../../services/StreamClient';
import type { MarketrixConfig } from '../../types';
import { getModeDescription, getModeDisplayName } from '../../utils/format';
import { Pill } from '../base/Pill';
import { DiagnosticModal } from '../ui/DiagnosticModal';

interface ModeSelectorProps {
  currentMode: InstructionType;
  enabledModes: InstructionType[];
  onModeChange: (mode: InstructionType) => void;
  isScreenSharing?: boolean;
  config?: MarketrixConfig;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  enabledModes,
  onModeChange,
  isScreenSharing = false,
  config,
}) => {
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);

  const getModeIcon = (mode: InstructionType) => {
    switch (mode) {
      case 'show':
        return <LuMousePointerClick className='w-4 h-4 text-base' />;
      case 'tell':
        return <IoChatbubbleEllipsesOutline className='w-4 h-4 text-base' />;
      case 'do':
        return <SiTicktick className='w-4 h-4 text-base' />;
      default:
        return null;
    }
  };

  // Reorder modes to: Tell, Show, Do
  const orderedModes: InstructionType[] = (['tell', 'show', 'do'] as const).filter(mode => enabledModes.includes(mode));

  return (
    <div className='px-3 pb-2 bg-transparent flex items-center justify-between gap-2'>
      <div className='flex space-x-2 flex-shrink-0'>
        {orderedModes.map((mode: InstructionType) => (
          <Pill
            key={mode}
            active={currentMode === mode}
            size='md'
            animated={isScreenSharing && currentMode === mode}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onModeChange(mode);
            }}
            title={getModeDescription(mode)}
          >
            {getModeIcon(mode)}
            <span className='text-xs font-medium'>{getModeDisplayName(mode)}</span>
          </Pill>
        ))}
      </div>
      <img
        src={MarketrixLogo}
        alt='Marketrix Logo'
        className='h-5 w-auto object-contain flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity'
        style={{ maxWidth: '100px' }}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setIsDiagnosticModalOpen(true);
        }}
      />
      <DiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        diagnosticData={{
          chatId: sessionManager.getChatId(),
          streamEndpoint: (() => {
            const apiHost = configManager.getConfig()?.mtxApiHost || config?.mtxApiHost;
            return apiHost ? `${apiHost.replace(/\/$/, '')}/widget/stream` : null;
          })(),
          connectionStatus: (() => {
            try {
              return StreamClient.getInstance().getStatus();
            } catch {
              return 'disconnected';
            }
          })(),
          applicationId: configManager.getConfig()?.mtxApp,
          agentId: configManager.getConfig()?.mtxAgent,
          version: packageJson.version,

          build: typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev',
        }}
      />
    </div>
  );
};

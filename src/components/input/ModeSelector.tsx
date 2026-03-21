import React, { useState } from 'react';

import packageJson from '../../../package.json';
import MarketrixLogo from '../../assets/marktrix-footer.png';
import type { InstructionType } from '../../sdk';
import { configManager } from '../../services/ConfigManager';
import { sessionManager } from '../../services/SessionManager';
import { StreamClient } from '../../services/StreamClient';
import type { MarketrixConfig } from '../../types';
import { getModeDescription, getModeDisplayName } from '../../utils/format';
import { Avatar } from '../base/Avatar';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Pill } from '../base/Pill';
import { Text } from '../base/Text';
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
        return <Icon name='mousePointerClick' size={16} />;
      case 'tell':
        return <Icon name='chatBubble' size={16} />;
      case 'do':
        return <Icon name='ticktick' size={16} />;
      default:
        return null;
    }
  };

  // Reorder modes to: Tell, Show, Do
  const orderedModes: InstructionType[] = (['tell', 'show', 'do'] as const).filter(mode => enabledModes.includes(mode));

  return (
    <Flex
      paddingX='lg'
      paddingY='md'
      align='center'
      justify='between'
      gap='md'
      style={{ backgroundColor: 'transparent' }}
    >
      <Flex gap='md' shrink={false}>
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
            <Text as='span' size='xs' weight='medium' style={{ color: 'inherit' }}>
              {getModeDisplayName(mode)}
            </Text>
          </Pill>
        ))}
      </Flex>
      <Avatar
        src={MarketrixLogo}
        alt='Marketrix Logo'
        style={{
          height: '20px',
          width: 'auto',
          objectFit: 'contain',
          maxWidth: '100px',
          flexShrink: 0,
          cursor: 'pointer',
        }}
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
    </Flex>
  );
};

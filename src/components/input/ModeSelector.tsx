import React, { useState } from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import packageJson from '../../../package.json';
import MarketrixLogo from '../../assets/marktrix-footer.png';
import { useWidget } from '../../hooks/useWidget';
import type { InstructionType } from '../../sdk';
import { configManager } from '../../services/ConfigManager';
import { sessionManager } from '../../services/SessionManager';
import { StreamClient } from '../../services/StreamClient';
import type { MarketrixConfig } from '../../types';
import { addOpacity, getContrastingColor, getModeDescription, getModeDisplayName } from '../../utils/format';
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
  const { config: widgetConfig } = useWidget(config ? { config } : {});
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
    <div
      className={`
        px-3 pb-2
        bg-transparent flex items-center justify-between gap-2
      `}
    >
      <div className='flex space-x-2 flex-shrink-0'>
        {orderedModes.map((mode: InstructionType) => (
          <button
            key={mode}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onModeChange(mode);
            }}
            className={`
                flex items-center justify-center gap-1 text-sm font-medium transition-all duration-200 relative
                ${currentMode === mode ? 'shadow-lg' : ''}
                ${
                  isScreenSharing && currentMode === mode
                    ? 'border-2'
                    : currentMode === mode
                      ? 'border-2 border-transparent'
                      : ''
                }
              `}
            style={{
              width: '65px',
              height: '26px',
              borderRadius: '22px',
              opacity: 1,
              ...(currentMode === mode
                ? {
                    backgroundColor: widgetConfig.widget_accent_color,
                    color: getContrastingColor(widgetConfig.widget_accent_color),
                  }
                : {
                    backgroundColor: addOpacity(widgetConfig.widget_secondary_color, 0.2),
                    color: widgetConfig.widget_text_color,
                    borderColor: addOpacity(widgetConfig.widget_secondary_color, 0.3),
                  }),
              ...(isScreenSharing && currentMode === mode
                ? {
                    animation: 'glow-border-pulse 2s ease-in-out infinite',
                    borderColor: 'rgba(255, 255, 255, 0.6)',
                  }
                : {}),
            }}
            onMouseEnter={e => {
              if (currentMode !== mode) {
                e.currentTarget.style.backgroundColor = addOpacity(widgetConfig.widget_secondary_color, 0.3);
                e.currentTarget.style.borderColor = addOpacity(widgetConfig.widget_secondary_color, 0.4);
              }
            }}
            onMouseLeave={e => {
              if (currentMode !== mode) {
                e.currentTarget.style.backgroundColor = addOpacity(widgetConfig.widget_secondary_color, 0.2);
                e.currentTarget.style.borderColor = addOpacity(widgetConfig.widget_secondary_color, 0.3);
              }
            }}
            title={getModeDescription(mode)}
          >
            {getModeIcon(mode)}
            <span className='text-xs font-medium'>{getModeDisplayName(mode)}</span>
          </button>
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
          tabId: sessionManager.getTabId(),
          websocketEndpoint: (() => {
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
          connectionId: configManager.getConfig()?.mtxApp,
          agentId: configManager.getConfig()?.mtxAgent,
          version: packageJson.version,
          // eslint-disable-next-line no-undef
          build: typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev',
        }}
      />
    </div>
  );
};

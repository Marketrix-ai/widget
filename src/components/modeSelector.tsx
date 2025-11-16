import React from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import MarketrixLogo from '../assets/marktrix-footer.png';
import type { ChatMode } from '../types';
import { getModeDescription, getModeDisplayName } from '../utils/textFormatting';

interface ModeSelectorProps {
  currentMode: ChatMode;
  enabledModes: ChatMode[];
  onModeChange: (mode: ChatMode) => void;
  isScreenSharing?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  enabledModes,
  onModeChange,
  isScreenSharing = false,
}) => {
  const getModeIcon = (mode: ChatMode) => {
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
  const orderedModes: ChatMode[] = (['tell', 'show', 'do'] as const).filter((mode) =>
    enabledModes.includes(mode)
  );

  return (
    <div
      className={`
        px-3 pb-2
        bg-transparent flex items-center justify-between gap-2
      `}
    >
      <div className='flex space-x-2 flex-shrink-0'>
        {orderedModes.map((mode: ChatMode) => (
          <button
            key={mode}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onModeChange(mode);
            }}
            className={`
                flex items-center justify-center gap-1 text-sm font-medium transition-all duration-200 relative
                ${
                  currentMode === mode
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-purple-100 text-black hover:bg-purple-200 border border-purple-200'
                }
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
              ...(isScreenSharing && currentMode === mode
                ? {
                    animation: 'glow-border-pulse 2s ease-in-out infinite',
                    borderColor: 'rgba(255, 255, 255, 0.6)',
                  }
                : {}),
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
        className='h-5 w-auto object-contain flex-shrink-0'
        style={{ maxWidth: '100px' }}
      />
    </div>
  );
};

import React from 'react';
import { ChatMode } from '../types';
import { getModeDisplayName, getModeDescription } from '../utils/formatting';

interface ModeSelectorProps {
  currentMode: ChatMode;
  enabledModes: ChatMode[];
  onModeChange: (mode: ChatMode) => void;
  theme: 'light' | 'dark';
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  enabledModes,
  onModeChange,
  theme,
}) => {
  const isDark = theme === 'dark';

  const getModeIcon = (mode: ChatMode) => {
    switch (mode) {
      case 'show':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.259-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.259zm10.82-.259a1 1 0 00-1.932-.518l-.259.966a1 1 0 101.932.518l.259-.966zm-1.932 2.032a1 1 0 00.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.259zM6.5 9.5a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1H6.5zM11 9.5a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1h-1z" />
          </svg>
        );
      case 'tell':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        );
      case 'do':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Reorder modes to: Tell, Show, Do
  const orderedModes: ChatMode[] = (['tell', 'show', 'do'] as const).filter(mode => 
    enabledModes.includes(mode)
  );

  return (
          <div className={`
        px-3 pb-2
        bg-transparent
      `}>
              <div className="flex space-x-2">
          {orderedModes.map((mode: ChatMode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`
                flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${currentMode === mode
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                  : 'bg-white/80 text-gray-600 hover:bg-white/90 hover:shadow-md border border-white/50 backdrop-blur-sm'
                }
              `}
            title={getModeDescription(mode)}
          >
            {getModeIcon(mode)}
            <span className="text-xs">{getModeDisplayName(mode)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

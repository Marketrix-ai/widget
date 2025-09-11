import React from 'react';
import { ChatMode } from '../types';
import { getModeDisplayName, getModeDescription } from '../utils/formatting';
import { FiZap, FiMessageCircle, FiCheck } from 'react-icons/fi';
import { IoChatbubbleEllipsesOutline } from "react-icons/io5";
import { LuMousePointerClick } from "react-icons/lu";
import { SiTicktick } from "react-icons/si";
import MarketrixLogo from "../assets/marktrix-footer.png";

interface ModeSelectorProps {
  currentMode: ChatMode;
  enabledModes: ChatMode[];
  onModeChange: (mode: ChatMode) => void;
  onScreenAccessRequest?: (mode: ChatMode) => void;
  theme: 'light' | 'dark';
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  enabledModes,
  onModeChange,
  onScreenAccessRequest,
  theme,
}) => {

  const getModeIcon = (mode: ChatMode) => {
    switch (mode) {
      case 'show':
        return <LuMousePointerClick className="w-4 h-4" />;
      case 'tell':
        return <IoChatbubbleEllipsesOutline className="w-4 h-4" />;
      case 'do':
        return <SiTicktick className="w-4 h-4" />;
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
        bg-transparent flex items-center justify-between
      `}>
              <div className="flex space-x-2">
          {orderedModes.map((mode: ChatMode) => (
            <button
              key={mode}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onModeChange(mode);
                // Show screen access modal for show and do modes
                if ((mode === 'show' || mode === 'do') && onScreenAccessRequest) {
                  onScreenAccessRequest(mode);
                }
              }}
              className={`
                flex items-center justify-center gap-1 text-sm font-medium transition-all duration-200
                ${currentMode === mode
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-purple-100 text-black hover:bg-purple-200 border border-purple-200'
                }
              `}
              style={{
                width: '65px',
                height: '26px',
                borderRadius: '22px',
                opacity: 1
              }}
            title={getModeDescription(mode)}
          >
            {getModeIcon(mode)}
            <span className="text-xs font-medium">{getModeDisplayName(mode)}</span>
          </button>
        ))}
      </div>
      <img src={MarketrixLogo} alt="Marketrix Logo" className="w-18 h-5 object-cover" />
    </div>
  );
};

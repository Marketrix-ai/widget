import React, { useState, useEffect } from 'react';
import SendIcon from '../assets/send.png';
import { LuMousePointerClick } from "react-icons/lu";
import { IoChatbubbleEllipsesOutline } from "react-icons/io5";
import { SiTicktick } from "react-icons/si";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isLoading: boolean;
  theme: 'light' | 'dark';
  placeholder?: string;
  currentMode?: string;
  onScreenAccessResponse?: (allowed: boolean) => void;
  triggerScreenAccessModal?: boolean;
  onTriggerReset?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onKeyPress,
  onSend,
  isLoading,
  theme,
  placeholder = "How can I help you?",
  currentMode,
  onScreenAccessResponse,
  triggerScreenAccessModal = false,
  onTriggerReset,
}) => {
  const [showScreenAccessModal, setShowScreenAccessModal] = useState(false);

  // Trigger modal when prop changes
  useEffect(() => {
    if (triggerScreenAccessModal) {
      setShowScreenAccessModal(true);
    }
  }, [triggerScreenAccessModal]);

  const getModeDisplayName = (mode: string) => {
    switch (mode) {
      case 'show':
        return 'Show';
      case 'tell':
        return 'Tell';
      case 'do':
        return 'Do';
      default:
        return mode;
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'show':
        return <LuMousePointerClick className="w-3 h-3" />;
      case 'tell':
        return <IoChatbubbleEllipsesOutline className="w-3 h-3" />;
      case 'do':
        return <SiTicktick className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const handleSend = () => {
    if ((currentMode === 'show' || currentMode === 'do') && value.trim()) {
      setShowScreenAccessModal(true);
    } else {
      onSend();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else {
      onKeyPress(e);
    }
  };

  const handleScreenAccessResponse = (allowed: boolean) => {
    setShowScreenAccessModal(false);
    if (allowed) {
      // Notify parent component about screen access
      onScreenAccessResponse?.(true);
      // Proceed with sending the message
      onSend();
    }
    // If not allowed, just close the modal without sending
  };

  // Reset trigger when modal is shown
  useEffect(() => {
    if (showScreenAccessModal && triggerScreenAccessModal) {
      // Reset the trigger in parent component
      onTriggerReset?.();
    }
  }, [showScreenAccessModal, triggerScreenAccessModal, onTriggerReset]);

  return (
    <div className={`
      py-2 pr-2
      bg-transparent
      `}>
        <div className="flex items-center space-x-2">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Show me.."
            disabled={isLoading}
            rows={1}
            className={`
              w-full px-3 py-2 text-sm resize-none
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              bg-white border-gray-200 text-gray-900 placeholder-gray-400
              shadow-sm
            `}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
            }}
          />
        </div>

        {/* Circular Send button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSend();
          }}
          disabled={!value.trim() || isLoading}
          className={`
            w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center
            ${value.trim() && !isLoading
              ? 'bg-gradient-to-r from-[#B398F6] to-[#5CF2B5] text-white shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
            focus:outline-none focus:ring-2 focus:ring-green-500/20
          `}
          aria-label="Send message"
        >
          <img src={SendIcon} alt="Send" className="w-4 h-4" />
        </button>
      </div>

      {/* Screen Access Modal */}
      {showScreenAccessModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleScreenAccessResponse(false);
            }
          }}
        >
          <div className="bg-white rounded-lg p-3 max-w-md mx-4 shadow-xl">
            <div className="text-center">
              
              <h3 className="font-inter text-md font-semibold text-gray-900 mb-2">
                Can I take a look at your screen?
              </h3>
              
              <p className="text-gray-600 mb-6 font-inter text-xs text-left leading-relaxed">
                By allowing screen access, Marketrix can understand your current context to guide you better and complete tasks on your behalf.
              </p>
              
              <div className="flex gap-3 justify-center">
              <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleScreenAccessResponse(true);
                  }}
                  className="text-xs px-6 py-1 bg-[#E7DDFF] text-[#6941C6] rounded-3xl hover:opacity-90 transition-opacity"
                >
                  Yes
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleScreenAccessResponse(false);
                  }}
                  className="text-xs px-6 py-1 border bg-[#E7DDFF] text-[#6941C6] rounded-3xl hover:bg-gray-50 transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

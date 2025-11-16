import React, { useEffect, useState } from 'react';
import { LuSquare } from 'react-icons/lu';

import SendIcon from '../assets/send.png';
import { useWidget } from '../hooks/useWidget';
import type { MarketrixConfig } from '../types';
import { elementHighlighter } from '../utils/elementHighlighting';
import { ScreenAccessModal } from './screenAccessModal';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isLoading: boolean;
  config?: MarketrixConfig;
  onScreenAccessResponse?: (allowed: boolean) => void;
  triggerScreenAccessModal?: boolean;
  onTriggerReset?: () => void;
  isStepGuideRunning?: boolean;
  onStopStepGuide?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onKeyPress,
  onSend,
  isLoading,
  config,
  onScreenAccessResponse,
  triggerScreenAccessModal = false,
  onTriggerReset,
  isStepGuideRunning = false,
  onStopStepGuide,
}) => {
  const [showScreenAccessModal, setShowScreenAccessModal] = useState(false);

  // Get atmosphere configuration
  const { getWidgetText } = useWidget(config ? { config } : {});
  const widgetText = getWidgetText();

  // Trigger modal when prop changes
  useEffect(() => {
    if (triggerScreenAccessModal) {
      setShowScreenAccessModal(true);
    }
  }, [triggerScreenAccessModal]);

  const handleSend = () => {
    // Process the message for highlighting
    processMessageForHighlighting(value);
    // Send the message
    onSend();
  };

  const handleStopStepGuide = () => {
    if (onStopStepGuide) {
      onStopStepGuide();
    }
  };

  const processMessageForHighlighting = (message: string) => {
    const lowerMessage = message.toLowerCase();

    // Check for common highlighting patterns
    if (
      lowerMessage.includes('highlight') ||
      lowerMessage.includes('show me') ||
      lowerMessage.includes('point to')
    ) {
      // Look for specific element references
      if (
        lowerMessage.includes('h1') ||
        lowerMessage.includes('title') ||
        lowerMessage.includes('heading')
      ) {
        elementHighlighter.highlightBySelector('h1', {
          duration: 5000,
          spotlightColor: 'rgba(255, 255, 0, 0.4)',
          borderColor: '#ffd700',
          borderWidth: 4,
        });
      } else if (lowerMessage.includes('h2')) {
        elementHighlighter.highlightBySelector('h2', {
          duration: 5000,
          spotlightColor: 'rgba(0, 255, 255, 0.4)',
          borderColor: '#00ffff',
          borderWidth: 4,
        });
      } else if (lowerMessage.includes('button')) {
        elementHighlighter.highlightBySelector('button', {
          duration: 5000,
          spotlightColor: 'rgba(0, 255, 0, 0.4)',
          borderColor: '#00ff00',
          borderWidth: 4,
        });
      } else if (lowerMessage.includes('demo') || lowerMessage.includes('widget')) {
        elementHighlighter.highlightByText('Marketrix In-App Support Widget Demo', {
          duration: 5000,
          spotlightColor: 'rgba(255, 0, 255, 0.4)',
          borderColor: '#ff00ff',
          borderWidth: 4,
        });
      }
    }

    // Check for specific text content to highlight
    if (lowerMessage.includes('marketrix') && lowerMessage.includes('demo')) {
      elementHighlighter.highlightByText('Marketrix In-App Support Widget Demo', {
        duration: 5000,
        spotlightColor: 'rgba(255, 255, 0, 0.4)',
        borderColor: '#ffd700',
        borderWidth: 4,
      });
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
    } else {
      onScreenAccessResponse?.(false);
    }
  };

  const handleCloseModal = () => {
    setShowScreenAccessModal(false);
    onTriggerReset?.();
  };

  // Reset trigger when modal is shown
  useEffect(() => {
    if (showScreenAccessModal && triggerScreenAccessModal) {
      // Reset the trigger in parent component
      onTriggerReset?.();
    }
  }, [showScreenAccessModal, triggerScreenAccessModal, onTriggerReset]);

  return (
    <div
      className={`
      py-2 pr-2
      bg-transparent
      `}
    >
      <div className='flex items-center space-x-2'>
        {/* Textarea */}
        <div className='flex-1 relative'>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={widgetText.placeholder || 'Show me..'}
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

        {/* Circular Send/Stop button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isStepGuideRunning) {
              handleStopStepGuide();
            } else {
              handleSend();
            }
          }}
          disabled={!isStepGuideRunning && (!value.trim() || isLoading)}
          className={`
            w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center
            ${
              isStepGuideRunning
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:from-red-600 hover:to-red-700'
                : value.trim() && !isLoading
                  ? 'bg-gradient-to-r from-[#B398F6] to-[#5CF2B5] text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
            focus:outline-none focus:ring-2 focus:ring-green-500/20
          `}
          aria-label={isStepGuideRunning ? 'Stop step guide' : 'Send message'}
        >
          {isStepGuideRunning ? (
            <LuSquare className='w-4 h-4' />
          ) : (
            <img src={SendIcon} alt='Send' className='w-4 h-4' />
          )}
        </button>
      </div>

      {/* Screen Access Modal */}
      <ScreenAccessModal
        isOpen={showScreenAccessModal}
        onAllow={() => handleScreenAccessResponse(true)}
        onDeny={() => handleScreenAccessResponse(false)}
        onClose={handleCloseModal}
      />
    </div>
  );
};

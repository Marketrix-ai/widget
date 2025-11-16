import React, { useEffect, useRef, useState } from 'react';

import { useWidget } from '../hooks/useWidget';
import type { ChatMessage, ChatMode, MarketrixConfig } from '../types';
import { getPositionClasses } from '../utils/widgetPositioning';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { ModeSelector } from './modeSelector';

interface ChatWindowProps {
  config: MarketrixConfig;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: ChatMode;
  agentAvailable: boolean;
  onClose: () => void;
  onSendMessage: (message: string, mode?: ChatMode) => void;
  onSetMode: (mode: ChatMode) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  config,
  isOpen,
  isMinimized,
  isLoading,
  messages,
  currentMode,
  onClose,
  onSendMessage,
  onSetMode,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get atmosphere configuration
  const { getWidgetCustomize, getWidgetPosition, settings } = useWidget({ config });

  const widgetCustomize = getWidgetCustomize();
  const widgetPosition = getWidgetPosition();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue, currentMode);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get widget settings for positioning
  const effectivePosition = widgetPosition.position || settings.widget_position || 'bottom_right';
  const positionClasses = getPositionClasses(effectivePosition);

  if (!isOpen) return null;

  // Apply custom styling from settings
  const customStyles = {
    width: settings.widget_width || widgetCustomize.sizes?.width || '320px',
    height: isMinimized
      ? '48px'
      : settings.widget_height || widgetCustomize.sizes?.height || '35rem',
    borderRadius: settings.widget_border_radius || widgetCustomize.sizes?.border_radius || '12px',
    fontSize: settings.widget_font_size || widgetCustomize.sizes?.font_size || '14px',
    background: settings.widget_background_color || widgetCustomize.colors?.background || 'white',
    color: settings.widget_text_color || widgetCustomize.colors?.text || '#333333',
    borderColor:
      settings.widget_border_color || widgetCustomize.colors?.border || 'rgba(255, 255, 255, 0.2)',
    boxShadow: settings.widget_shadow || '0 10px 25px rgba(0, 0, 0, 0.1)',
    zIndex: widgetPosition.z_index || 40,
  } satisfies React.CSSProperties;

  return (
    <div
      className={`fixed bg-white rounded-xl ${positionClasses}`}
      style={{ zIndex: widgetPosition.z_index || 40 }}
    >
      <div
        className={`
          bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700
          w-[360px] max-w-sm
          ${isMinimized ? 'h-12' : 'h-[35rem]'} 
          transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? 'animate-slide-up' : 'animate-slide-down'}
          transform-gpu
          shadow-2xl
          backdrop-blur-sm
          scrollbar-thin scrollbar-track-[#f6f6f6] scrollbar-thumb-[#b6b6b6]
        `}
        style={{
          ...customStyles,
          scrollbarColor: '#f6f6f6 #b6b6b6',
          scrollbarWidth: 'thin',
        }}
      >
        {/* Header with Marketrix branding */}
        <div
          className={`
          flex justify-end p-2 mb-5
                  `}
        >
          <div className='flex items-center space-x-1 bg-white rounded-full p-0.5 absolute top-2 right-2'>
            <button
              onClick={onClose}
              className='p-1 rounded-full hover:bg-white shadow-sm'
              aria-label='Close chat'
            >
              <svg className='w-3 h-3 text-black' fill='currentColor' viewBox='0 0 20 20'>
                <path
                  fillRule='evenodd'
                  d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                  clipRule='evenodd'
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Content */}
        {!isMinimized && (
          <>
            {/* Chat Messages Area */}
            <div className='flex-1 overflow-hidden'>
              <MessageList
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                onSendMessage={onSendMessage}
                onSetMode={onSetMode}
                config={config}
              />
            </div>

            {/* Controls Section */}
            <div className='flex-shrink-0 rounded-lg bg-white m-3'>
              {/* Input */}
              <MessageInput
                value={inputValue}
                onChange={setInputValue}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                isLoading={isLoading}
                config={config}
              />

              {/* Mode Selector */}
              <ModeSelector
                currentMode={currentMode}
                enabledModes={config.enabledModes || ['tell', 'show', 'do']}
                onModeChange={onSetMode}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MarketrixConfig, ChatMode } from '../types';
import { getChatWindowClasses, getPositionClasses } from '../utils/positioning';
import { formatTimestamp, formatMessageTime, getModeDisplayName } from '../utils/formatting';
import { ModeSelector } from './ModeSelector';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface ChatWindowProps {
  config: MarketrixConfig;
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentMode: ChatMode;
  agentAvailable: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  onSetMode: (mode: ChatMode) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  config,
  isOpen,
  isMinimized,
  isLoading,
  messages,
  currentMode,
  agentAvailable,
  onClose,
  onSendMessage,
  onSetMode,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const theme = config.theme || 'light';
  const isDark = theme === 'dark';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  const positionClasses = getPositionClasses(config.position || 'bottom-right');
  const chatWindowClasses = getChatWindowClasses(config.position || 'bottom-right');

  return (
    <div className={`fixed ${positionClasses} z-40`}>
      <div className={`
        ${chatWindowClasses} 
        ${isMinimized ? 'h-12' : 'h-[35rem]'} 
        transition-all duration-300 ease-in-out flex flex-col
        ${isOpen ? 'animate-slide-up' : 'animate-slide-down'}
        transform-gpu
        bg-gradient-to-br from-green-50 via-white to-purple-50
        shadow-2xl
        rounded-lg
        border border-white/20
        backdrop-blur-sm
      `}>
        {/* Header with Marketrix branding */}
        <div className={`
          flex items-center justify-between p-3 border-b border-white/30 flex-shrink-0
          bg-white/80 backdrop-blur-sm rounded-t-lg
        `}>
          <div className="flex items-center space-x-2">
            {/* Marketrix Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">X</span>
              </div>
              <span className="text-gray-800 font-semibold text-sm">marketrix</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100"
              aria-label="Close chat"
            >
              <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Content */}
        {!isMinimized && (
          <>
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-hidden">
              <MessageList
                messages={messages}
                isLoading={isLoading}
                theme={theme}
                messagesEndRef={messagesEndRef}
                config={config}
                onSendMessage={onSendMessage}
              />
            </div>

            {/* Second Horizontal Line */}
            <div className="flex-shrink-0 px-4">
              <div className="border-t border-white/30"></div>
            </div>

            {/* Controls Section */}
            <div className="flex-shrink-0">
              {/* Input */}
              <MessageInput
                value={inputValue}
                onChange={setInputValue}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                isLoading={isLoading}
                theme={theme}
                placeholder="How can I help you?"
              />

              {/* Mode Selector */}
              <ModeSelector
                currentMode={currentMode}
                enabledModes={config.enabledModes || ['tell', 'show', 'do']}
                onModeChange={onSetMode}
                theme={theme}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

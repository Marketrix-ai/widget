import React from 'react';
import { ChatMessage, MarketrixConfig } from '../types';
import { formatMessageTime, getModeDisplayName } from '../utils/formatting';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  theme: 'light' | 'dark';
  messagesEndRef: React.RefObject<HTMLDivElement>;
  config: MarketrixConfig;
  onSendMessage?: (message: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  theme,
  messagesEndRef,
  config,
  onSendMessage,
}) => {
  const isDark = theme === 'dark';

  const getModeBadgeColor = (mode?: 'show' | 'tell' | 'do') => {
    switch (mode) {
      case 'show':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'tell':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'do':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Suggested actions to show when no messages
  const suggestedActions = [
    {
      text: "Show me how to create an invoice",
      icon: "👆",
      type: "show",
      isShow: true
    },
    {
      text: "Show me how to set up automated invoice reminders",
      icon: "👆", 
      type: "show",
      isShow: true
    },
    {
      text: "What is deferred revenue and how should I report it in QuickBooks?",
      icon: "💬",
      type: "tell",
      isShow: false
    }
  ];

  const handleSuggestedActionClick = (action: typeof suggestedActions[0]) => {
    if (onSendMessage) {
      onSendMessage(action.text);
    }
  };

  return (
          <div className={`
        h-full overflow-y-auto p-3 space-y-3
        bg-transparent
      `}>
      {messages.length === 0 && !isLoading && (
        <div className="space-y-3">
          {/* Welcome message */}
          <div className="flex justify-start">
            <div className="w-full px-3 py-2 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg border border-white/50">
              <div className="text-sm text-gray-800">
                Hey! 👋 I'm Marketrix AI, How can I help you
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs text-gray-600">
                <span>Marketrix AI</span>
                <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {/* Suggested actions */}
          <div className="space-y-2">
            {suggestedActions.map((action, index) => (
              <div key={index} className="flex justify-start">
                <button
                  onClick={() => handleSuggestedActionClick(action)}
                  className={`
                    w-full px-3 py-2 rounded-2xl cursor-pointer transition-all duration-200 shadow-lg border text-left hover:shadow-xl hover:scale-105
                    ${action.isShow 
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200/50 hover:from-blue-100 hover:to-indigo-100' 
                      : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/50 hover:from-green-100 hover:to-emerald-100'
                    }
                  `}
                >
                  <div className="text-sm text-gray-700 flex items-center space-x-2">
                    <span>{action.icon}</span>
                    <span>{action.text}</span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
        >
                      <div className={`
              w-full px-3 py-2 rounded-2xl shadow-lg border
              ${message.sender === 'user'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400/30'
                : 'bg-white/90 backdrop-blur-sm text-gray-800 border-white/50'
              }
            `}>
            {/* Message content */}
            <div className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </div>
            
            {/* Message metadata */}
            <div className={`
              flex items-center justify-between mt-1.5 text-xs
              ${message.sender === 'user'
                ? 'text-blue-100'
                : 'text-gray-600'
              }
            `}>
              <span>{message.sender === 'user' ? 'You' : 'Marketrix AI'}</span>
              <span>{formatMessageTime(message.timestamp)}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="w-full px-3 py-2 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg border border-white/50">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-xs text-gray-600">Typing...</span>
            </div>
          </div>
        </div>
      )}

      {/* Auto-scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
};

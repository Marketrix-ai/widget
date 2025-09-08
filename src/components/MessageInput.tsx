import React from 'react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isLoading: boolean;
  theme: 'light' | 'dark';
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onKeyPress,
  onSend,
  isLoading,
  theme,
  placeholder = "How can I help you?",
}) => {
  const isDark = theme === 'dark';

  return (
    <div className={`
      p-3 border-t border-white/30
      bg-white/80 backdrop-blur-sm
    `}>
      <div className="flex items-center space-x-2">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className={`
              w-full px-3 py-2 text-sm border rounded-2xl resize-none
              focus:outline-none focus:ring-2 focus:ring-green-500/20
              disabled:opacity-50 disabled:cursor-not-allowed
              bg-white/90 border-white/50 text-gray-900 placeholder-gray-500
              shadow-lg backdrop-blur-sm
            `}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
            }}
          />
        </div>

        {/* Circular Send button */}
        <button
          onClick={onSend}
          disabled={!value.trim() || isLoading}
          className={`
            w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center
            ${value.trim() && !isLoading
              ? 'bg-gradient-to-r from-green-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105'
              : 'bg-gray-200/50 text-gray-400 cursor-not-allowed'
            }
            focus:outline-none focus:ring-2 focus:ring-green-500/20
            backdrop-blur-sm
          `}
          aria-label="Send message"
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 010-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

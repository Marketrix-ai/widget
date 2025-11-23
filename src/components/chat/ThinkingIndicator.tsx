import React from 'react';

import { addOpacity } from '../../utils/format';

interface ThinkingIndicatorProps {
  isWaitingForUser: boolean;
  textColor: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  isWaitingForUser,
  textColor,
}) => {
  return (
    <>
      {/* Subtle Facebook Messenger-style loading dots */}
      <div className='flex items-center gap-1 py-0.5'>
        <span className='messenger-dot' style={{ animationDelay: '0s' }} />
        <span className='messenger-dot' style={{ animationDelay: '0.15s' }} />
        <span className='messenger-dot' style={{ animationDelay: '0.3s' }} />
      </div>
      {/* State text with subtle ellipsis */}
      <div className='flex items-center'>
        <span
          className='text-[10px] font-inter font-normal'
          style={{ color: addOpacity(textColor, 0.5) }}
        >
          {isWaitingForUser ? 'Waiting for you to complete the action' : 'Thinking'}
          <span className='thinking-dots'>
            <span style={{ animationDelay: '0s' }}>.</span>
            <span style={{ animationDelay: '0.2s' }}>.</span>
            <span style={{ animationDelay: '0.4s' }}>.</span>
          </span>
        </span>
      </div>
      <style>{`
        @keyframes messenger-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-4px);
            opacity: 0.7;
          }
        }
        .messenger-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: ${addOpacity(textColor, 0.35)};
          animation: messenger-bounce 1.2s ease-in-out infinite;
          display: inline-block;
        }
        @keyframes thinking-dot {
          0%, 20% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        .thinking-dots span {
          animation: thinking-dot 1.4s infinite;
          margin-left: 1px;
        }
      `}</style>
    </>
  );
};

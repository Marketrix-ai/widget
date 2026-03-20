import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import type { ChatMessage, MarketrixConfig } from '../../types';
import { addOpacity } from '../../utils/format';
import { getSuggestedActionsFromConfig, type SuggestedActionItem } from '../../utils/suggestedActions';
import { SuggestedActions } from '../chat/SuggestedActions';

interface HomeViewProps {
  config: MarketrixConfig;
  messages: ChatMessage[];
  onNavigateToChat: () => void;
  onChipClick: (action: SuggestedActionItem) => void;
  onClose: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ config, messages, onNavigateToChat, onChipClick, onClose }) => {
  const suggestedActions = getSuggestedActionsFromConfig(config);
  const accentColor = config.widget_accent_color ?? '#3b82f6';
  const textColor = config.widget_text_color ?? '#1f2937';

  const handleActionClick = async (action: SuggestedActionItem, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onNavigateToChat();
    onChipClick(action);
  };

  return (
    <div className='flex flex-col h-full overflow-hidden' id='view-home' role='tabpanel' aria-labelledby='tab-home'>
      {/* Header with close button */}
      <div
        className='flex justify-between items-center px-3 py-2 border-b flex-shrink-0'
        style={{ borderColor: config.widget_border_color }}
      >
        <div className='flex items-center gap-2 min-w-0 flex-1'>
          <img
            src={MarketrixIcon}
            alt=''
            className='flex-shrink-0 w-8 h-8 rounded-[var(--radius)] object-cover'
            style={{ boxShadow: config.widget_shadow }}
          />
          <div className='min-w-0'>
            <div className='text-sm font-semibold leading-tight truncate' style={{ color: textColor }}>
              {config.widget_greeting ?? 'Hello'}
            </div>
            <p className='text-xs opacity-70 truncate' style={{ color: textColor }}>
              {config.widget_body ?? 'How can we help?'}
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='p-1.5 rounded-full opacity-60 hover:opacity-100 transition-opacity flex-shrink-0'
          style={{ color: textColor }}
          aria-label='Close'
        >
          <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
            <path
              fillRule='evenodd'
              d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
              clipRule='evenodd'
            />
          </svg>
        </button>
      </div>

      <div className='flex-1 overflow-y-auto p-3 space-y-3'>
        {/* Ask a question CTA */}
        <button
          type='button'
          onClick={onNavigateToChat}
          className='w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl font-medium text-white transition-opacity hover:opacity-95'
          style={{
            background: `linear-gradient(135deg, ${accentColor} 0%, ${addOpacity(accentColor, 0.85)} 100%)`,
            boxShadow: `0 2px 8px ${addOpacity(accentColor, 0.35)}`,
          }}
          aria-label='Ask a question'
        >
          <span className='flex items-center gap-2'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
              />
            </svg>
            Ask a question
          </span>
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
          </svg>
        </button>

        {/* Suggested action chips */}
        <div>
          <SuggestedActions
            actions={suggestedActions}
            hasPendingMessage={false}
            settings={{
              widget_secondary_color: config.widget_secondary_color ?? '#f3f4f6',
              widget_text_color: textColor,
            }}
            onActionClick={handleActionClick}
          />
        </div>

        {/* Recent conversation preview */}
        {messages.length > 0 && (
          <div
            className='p-3 rounded-lg border'
            style={{
              backgroundColor: addOpacity(config.widget_background_color ?? '#ffffff', 0.6),
              borderColor: config.widget_border_color ?? '#e5e7eb',
            }}
          >
            <p className='text-xs font-medium opacity-70 mb-1' style={{ color: textColor }}>
              Recent conversation
            </p>
            <p className='text-sm line-clamp-2' style={{ color: textColor }}>
              {messages[messages.length - 1].content || 'Message'}
            </p>
            <button
              type='button'
              onClick={onNavigateToChat}
              className='mt-2 text-xs font-medium'
              style={{ color: accentColor }}
            >
              Continue conversation →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

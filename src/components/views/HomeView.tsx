import React from 'react';

import type { ChatMessage, MarketrixConfig } from '../../types';
import { getSuggestedActionsFromConfig, type SuggestedActionItem } from '../../utils/suggestedActions';
import { SuggestedActions } from '../chat/SuggestedActions';

interface HomeViewProps {
  config: MarketrixConfig;
  messages: ChatMessage[];
  onNavigateToChat: () => void;
  onChipClick: (action: SuggestedActionItem) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ config, messages, onNavigateToChat, onChipClick }) => {
  const suggestedActions = getSuggestedActionsFromConfig(config);

  const handleActionClick = async (action: SuggestedActionItem, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onNavigateToChat();
    onChipClick(action);
  };

  return (
    <div className='flex flex-col h-full overflow-hidden' id='view-home' role='tabpanel' aria-labelledby='tab-home'>
      <div className='flex-1 overflow-y-auto p-3 space-y-3'>
        {/* Centered greeting */}
        <div className='text-center pt-2'>
          <h2 className='text-lg font-semibold text-foreground'>{config.widget_greeting ?? 'Hey There!'}</h2>
          <p className='text-sm text-foreground-muted mt-1'>{config.widget_body ?? 'How can I help you today?'}</p>
        </div>

        {/* Ask a question CTA */}
        <button
          type='button'
          onClick={onNavigateToChat}
          className='w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl font-medium bg-primary text-primary-foreground transition-opacity hover:opacity-95 shadow-sm'
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
              widget_text_color: config.widget_text_color ?? '#1f2937',
            }}
            onActionClick={handleActionClick}
          />
        </div>

        {/* Recent conversation preview */}
        {messages.length > 0 && (
          <div className='px-3 py-2 rounded-lg border border-border bg-background/60'>
            <p className='text-sm font-semibold text-foreground mb-0.5'>Recent conversation</p>
            <p className='text-xs text-foreground-muted line-clamp-2'>
              {messages[messages.length - 1].content || 'Message'}
            </p>
            <button type='button' onClick={onNavigateToChat} className='mt-1 text-xs font-medium text-primary'>
              Continue conversation →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

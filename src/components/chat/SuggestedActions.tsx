import React from 'react';

import { addOpacity } from '../../utils/format';

interface SuggestedAction {
  id: string;
  text: string;
  icon: React.ReactElement;
  type: 'tell' | 'show' | 'do';
  isShow: boolean;
}

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  hasPendingMessage: boolean;
  settings: {
    widget_secondary_color: string;
    widget_text_color: string;
  };
  onActionClick: (action: SuggestedAction, event: React.MouseEvent) => Promise<void>;
}

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({
  actions,
  hasPendingMessage,
  settings,
  onActionClick,
}) => {
  if (actions.length === 0) return null;

  return (
    <div className='mt-2.5 mb-1.5 p-0 flex flex-col gap-1'>
      {actions.map((action, chipIndex) => (
        <button
          key={`welcome-chip-${action.id}-${chipIndex}`}
          onClick={e => onActionClick(action, e)}
          disabled={hasPendingMessage}
          className={`
            w-full flex items-center justify-center gap-1 font-inter font-normal text-xs px-3 py-2 rounded-full
            transition-[background-color,color,border-color] duration-[250ms] ease-in-out text-left
            border border-solid
            ${hasPendingMessage ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          `}
          style={{
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderColor: 'rgba(0,0,0,0.12)',
            color: hasPendingMessage ? addOpacity(settings.widget_text_color, 0.5) : settings.widget_text_color,
          }}
          onMouseEnter={e => {
            if (!hasPendingMessage) {
              e.currentTarget.style.backgroundColor = settings.widget_text_color;
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = settings.widget_text_color;
            }
          }}
          onMouseLeave={e => {
            if (!hasPendingMessage) {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
              e.currentTarget.style.color = settings.widget_text_color;
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
            }
          }}
        >
          <span className='font-normal leading-none'>
            {action.type === 'show' ? (
              <>Show me {action.text.replace(/^Show me\s*/i, '')}</>
            ) : action.type === 'do' ? (
              <>Do {action.text.replace(/^Do\s*/i, '')}</>
            ) : (
              action.text
            )}
          </span>
        </button>
      ))}
    </div>
  );
};

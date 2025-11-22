import React from 'react';

import { addOpacity } from '../../utils/colorUtils';

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
          onClick={(e) => onActionClick(action, e)}
          disabled={hasPendingMessage}
          className={`
            w-full flex items-center gap-1 font-inter font-normal text-xs px-2.5 py-2 rounded-lg
            transition-all duration-200 text-left
            group
            leading-tight
            ${hasPendingMessage ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-100'}
          `}
          style={{
            backgroundColor: hasPendingMessage
              ? addOpacity(settings.widget_secondary_color, 0.1)
              : addOpacity(settings.widget_secondary_color, 0.2),
            borderColor: hasPendingMessage
              ? addOpacity(settings.widget_secondary_color, 0.15)
              : addOpacity(settings.widget_secondary_color, 0.3),
            color: hasPendingMessage
              ? addOpacity(settings.widget_text_color, 0.5)
              : settings.widget_text_color,
          }}
          onMouseEnter={(e) => {
            if (!hasPendingMessage) {
              e.currentTarget.style.backgroundColor = addOpacity(
                settings.widget_secondary_color,
                0.3
              );
              e.currentTarget.style.borderColor = addOpacity(settings.widget_secondary_color, 0.4);
            }
          }}
          onMouseLeave={(e) => {
            if (!hasPendingMessage) {
              e.currentTarget.style.backgroundColor = addOpacity(
                settings.widget_secondary_color,
                0.2
              );
              e.currentTarget.style.borderColor = addOpacity(settings.widget_secondary_color, 0.3);
            }
          }}
        >
          <span
            className='flex-shrink-0 flex items-center justify-center'
            style={{
              width: '0.75rem',
              height: '0.75rem',
              lineHeight: '0.75rem',
              color: settings.widget_secondary_color,
            }}
          >
            {action.icon}
          </span>
          <span className='font-normal leading-none' style={{ color: settings.widget_text_color }}>
            {action.type === 'show' ? (
              <>
                <span className='font-semibold' style={{ color: settings.widget_secondary_color }}>
                  Show me{' '}
                </span>
                {action.text.replace(/^Show me\s*/i, '')}
              </>
            ) : action.type === 'do' ? (
              <>
                <span className='font-semibold' style={{ color: settings.widget_secondary_color }}>
                  Do{' '}
                </span>
                {action.text.replace(/^Do\s*/i, '')}
              </>
            ) : (
              action.text
            )}
          </span>
        </button>
      ))}
    </div>
  );
};

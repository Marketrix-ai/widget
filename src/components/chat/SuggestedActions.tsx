import React from 'react';

import { addOpacity } from '../../utils/format';
import { Button, Stack, Text } from '../base';

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
    <Stack style={{ marginTop: '10px', marginBottom: '6px', gap: '4px' }}>
      {actions.map((action, chipIndex) => (
        <Button
          key={`welcome-chip-${action.id}-${chipIndex}`}
          variant='ghost'
          size='sm'
          full
          onClick={e => onActionClick(action, e)}
          disabled={hasPendingMessage}
          style={{
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderColor: 'rgba(0,0,0,0.12)',
            color: hasPendingMessage ? addOpacity(settings.widget_text_color, 0.5) : settings.widget_text_color,
            transition: 'background-color 250ms ease-in-out, color 250ms ease-in-out, border-color 250ms ease-in-out',
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
          <Text as='span' weight='normal' style={{ lineHeight: 1 }}>
            {action.type === 'show' ? (
              <>Show me {action.text.replace(/^Show me\s*/i, '')}</>
            ) : action.type === 'do' ? (
              <>Do {action.text.replace(/^Do\s*/i, '')}</>
            ) : (
              action.text
            )}
          </Text>
        </Button>
      ))}
    </Stack>
  );
};

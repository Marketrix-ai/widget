import React from 'react';

import { SHADOW } from '../../design-system/shadows';
import { useWidget } from '../../hooks/useWidget';
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
  onActionClick: (action: SuggestedAction, event: React.MouseEvent) => Promise<void>;
}

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({ actions, onActionClick }) => {
  const { config: widgetConfig } = useWidget();
  if (actions.length === 0) return null;

  return (
    <Stack gap='sm'>
      {actions.map((action, chipIndex) => (
        <Button
          key={`welcome-chip-${action.id}-${chipIndex}`}
          variant='ghost'
          size='sm'
          full
          onClick={e => onActionClick(action, e)}
          className='hover:bg-primary hover:text-primary-foreground hover:border-primary'
          style={{
            backgroundColor: 'var(--secondary-bg)',
            color: widgetConfig.widget_text_color,
            paddingTop: '8px',
            paddingBottom: '8px',
            boxShadow: SHADOW.card,
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

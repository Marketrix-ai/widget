import React from 'react';

import { useWidgetConfig } from '../../hooks/useWidget';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { Button } from '../base/Button';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

interface SuggestedActionsProps {
  actions: SuggestedActionItem[];
  onActionClick: (action: SuggestedActionItem, event: React.MouseEvent) => Promise<void>;
}

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({ actions, onActionClick }) => {
  const widgetConfig = useWidgetConfig();
  if (actions.length === 0) return null;

  return (
    <Stack gap='sm'>
      {actions.map((action, chipIndex) => (
        <Button
          key={`welcome-chip-${action.id}-${chipIndex}`}
          elevation='card'
          shape='theme'
          size='sm'
          variant='chip'
          full
          onClick={e => onActionClick(action, e)}
          style={{
            color: widgetConfig.widget_text_color,
            paddingTop: '8px',
            paddingBottom: '8px',
          }}
        >
          <Text as='span' weight='normal' leading='tight'>
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

/**
 * `SuggestedActions` — the chip list rendered from `SuggestedActionItem`s, captions verbatim (the
 * mode prefix is applied in the config layer, not here), coloured with the tenant text colour.
 */
import React from 'react';

import { useWidgetConfig } from '../../hooks/useWidget';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { Button } from '../base/Button';
import { Stack } from '../base/Flex';
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
            {action.text}
          </Text>
        </Button>
      ))}
    </Stack>
  );
};

import React from 'react';

import { useWidget } from '../../hooks/useWidget';
import { Button, Flex, Icon, Stack, Text } from '../base';

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

const MODE_ICON_MAP = {
  show: 'mousePointerClick',
  tell: 'chatBubble',
  do: 'ticktick',
} as const;

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({ actions, onActionClick }) => {
  const { config: widgetConfig } = useWidget();
  if (actions.length === 0) return null;

  return (
    <Stack gap='xs'>
      {actions.map((action, chipIndex) => (
        <Button
          key={`welcome-chip-${action.id}-${chipIndex}`}
          elevation='card'
          shape='theme'
          size='sm'
          variant='chip'
          full
          onClick={e => onActionClick(action, e)}
          className='chip-action-hover'
          style={{
            color: widgetConfig.widget_text_color,
            paddingTop: '10px',
            paddingBottom: '10px',
            paddingLeft: '12px',
            paddingRight: '12px',
            justifyContent: 'flex-start',
            textAlign: 'left',
          }}
        >
          <Flex align='center' gap='sm' style={{ width: '100%' }}>
            <Flex
              align='center'
              justify='center'
              shrink={false}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-muted)',
                color: 'var(--primary)',
              }}
            >
              <Icon name={MODE_ICON_MAP[action.type]} size={14} />
            </Flex>
            <Text as='span' size='sm' weight='normal' leading='snug' style={{ flex: 1 }}>
              {action.text}
            </Text>
            <Flex shrink={false} style={{ opacity: 0.6 }}>
              <Icon name='chevronRight' size={14} />
            </Flex>
          </Flex>
        </Button>
      ))}
    </Stack>
  );
};

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
          className='chip-action-hover py-2.5 px-3 justify-start text-left'
          style={{
            color: widgetConfig.widget_text_color,
          }}
        >
          <Flex align='center' gap='sm' className='w-full'>
            <Flex
              align='center'
              justify='center'
              shrink={false}
              className='w-7 h-7 rounded-lg'
              style={{
                backgroundColor: 'var(--primary-muted)',
                color: 'var(--primary)',
              }}
            >
              <Icon name={MODE_ICON_MAP[action.type]} size={14} />
            </Flex>
            <Text as='span' size='sm' weight='normal' leading='snug' className='flex-1'>
              {action.text}
            </Text>
            <Flex shrink={false} className='opacity-60'>
              <Icon name='chevronRight' size={14} />
            </Flex>
          </Flex>
        </Button>
      ))}
    </Stack>
  );
};

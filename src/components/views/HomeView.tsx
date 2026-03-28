import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import type { ChatMessage, MarketrixConfig } from '../../types';
import { getSuggestedActionsFromConfig, type SuggestedActionItem } from '../../utils/suggestedActions';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Card } from '../base/Card';
import { Icon } from '../base/Icon';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
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
    <Stack height='full' overflow='hidden' id='view-home' role='tabpanel' aria-labelledby='tab-home'>
      <Stack grow overflowY='auto' padding='lg'>
        {/* Block 1: Greeting with avatar */}
        <Stack className='animate-stagger-1 pt-3 pb-4' align='center' gap='sm'>
          <Surface
            className='w-12 h-12 rounded-2xl p-0.5'
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              boxShadow: '0 4px 14px var(--primary-muted)',
            }}
          >
            <Avatar
              src={MarketrixIcon}
              alt=''
              size={44}
              rounded='lg'
              style={{ border: 'none', backgroundColor: 'transparent' }}
            />
          </Surface>
          <Text as='h2' size='lg' weight='semibold'>
            {config.widget_greeting ?? 'Hey There!'}
          </Text>
          <Text as='p' variant='muted' size='sm' className='-mt-1'>
            {config.widget_body ?? 'How can I help you today?'}
          </Text>
        </Stack>

        {/* Block 2: Actions — CTA + chips as one unit */}
        <Stack gap='sm'>
          <Surface className='animate-stagger-2'>
            <Button
              type='button'
              variant='primary'
              full
              onClick={onNavigateToChat}
              aria-label='Ask a question'
              className='py-2.5'
            >
              <Icon name='chat' size={16} />
              Ask a question
            </Button>
          </Surface>

          <Surface className='animate-stagger-3'>
            <SuggestedActions actions={suggestedActions} onActionClick={handleActionClick} />
          </Surface>
        </Stack>
      </Stack>

      {/* Block 3: Recent conversation — anchored at bottom */}
      {messages.length > 0 && (
        <Card className='animate-stagger-4 mx-3 mb-3'>
          <Text as='p' size='xs' weight='semibold' className='mb-0.5'>
            Recent conversation
          </Text>
          <Text as='p' size='xs' variant='muted' clamp={2}>
            {messages[messages.length - 1].content || 'Message'}
          </Text>
          <Button
            type='button'
            variant='inline'
            onClick={onNavigateToChat}
            className='mt-1'
            aria-label='Continue recent conversation'
          >
            <Text as='span' size='xs' variant='muted'>
              Continue conversation →
            </Text>
          </Button>
        </Card>
      )}
    </Stack>
  );
};

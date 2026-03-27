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
        <Stack
          className='animate-stagger-1'
          align='center'
          gap='sm'
          style={{ paddingTop: '12px', paddingBottom: '16px' }}
        >
          <Surface
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              padding: '2px',
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
          <Text as='p' variant='muted' size='sm' style={{ marginTop: '-4px' }}>
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
              style={{
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
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
        <Card className='animate-stagger-4' style={{ margin: '0 12px 12px 12px' }}>
          <Text as='p' size='xs' weight='semibold' style={{ marginBottom: '2px' }}>
            Recent conversation
          </Text>
          <Text as='p' size='xs' variant='muted' clamp={2}>
            {messages[messages.length - 1].content || 'Message'}
          </Text>
          <Button
            type='button'
            variant='inline'
            onClick={onNavigateToChat}
            style={{ marginTop: '4px' }}
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

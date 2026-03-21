import React from 'react';

import type { ChatMessage, MarketrixConfig } from '../../types';
import { getSuggestedActionsFromConfig, type SuggestedActionItem } from '../../utils/suggestedActions';
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
        {/* Block 1: Greeting */}
        <Surface style={{ textAlign: 'center', paddingTop: '8px', paddingBottom: '16px' }}>
          <Text as='h2' size='lg' weight='semibold'>
            {config.widget_greeting ?? 'Hey There!'}
          </Text>
          <Text as='p' variant='muted' size='sm' style={{ marginTop: '2px' }}>
            {config.widget_body ?? 'How can I help you today?'}
          </Text>
        </Surface>

        {/* Block 2: Actions — CTA + chips as one unit */}
        <Stack gap='sm'>
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

          <SuggestedActions actions={suggestedActions} onActionClick={handleActionClick} />
        </Stack>
      </Stack>

      {/* Block 3: Recent conversation — anchored at bottom */}
      {messages.length > 0 && (
        <Card style={{ margin: '0 12px 12px 12px' }}>
          <Text as='p' size='xs' weight='semibold' style={{ marginBottom: '2px' }}>
            Recent conversation
          </Text>
          <Text
            as='p'
            size='xs'
            variant='muted'
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {messages[messages.length - 1].content || 'Message'}
          </Text>
          <Text
            as='p'
            size='xs'
            variant='muted'
            onClick={onNavigateToChat}
            style={{ marginTop: '4px', cursor: 'pointer' }}
          >
            Continue conversation →
          </Text>
        </Card>
      )}
    </Stack>
  );
};

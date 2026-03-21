import React from 'react';

import type { ChatMessage, MarketrixConfig } from '../../types';
import { getSuggestedActionsFromConfig, type SuggestedActionItem } from '../../utils/suggestedActions';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
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
      <Stack grow overflowY='auto' padding='lg' gap='lg'>
        {/* Greeting */}
        <Surface style={{ textAlign: 'center', paddingTop: '8px' }}>
          <Text as='h2' size='lg' weight='semibold'>
            {config.widget_greeting ?? 'Hey There!'}
          </Text>
          <Text as='p' variant='muted' size='sm' style={{ marginTop: '2px' }}>
            {config.widget_body ?? 'How can I help you today?'}
          </Text>
        </Surface>

        {/* Ask a question CTA */}
        <Button
          type='button'
          variant='primary'
          full
          onClick={onNavigateToChat}
          aria-label='Ask a question'
          style={{
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            fontWeight: 500,
          }}
        >
          <Flex align='center' gap='md'>
            <Icon name='chat' size={20} />
            Ask a question
          </Flex>
          <Icon name='chevronRight' size={16} />
        </Button>

        {/* Suggested action chips */}
        <SuggestedActions
          actions={suggestedActions}
          settings={{
            widget_text_color: config.widget_text_color ?? '#1f2937',
          }}
          onActionClick={handleActionClick}
        />
      </Stack>

      {/* Recent conversation — anchored at bottom, matches chat input card style */}
      {messages.length > 0 && (
        <Surface
          style={{
            padding: '10px 16px',
            margin: '0 12px 12px 12px',
            borderRadius: 'var(--radius-xl, 12px)',
            border: '1px solid var(--border)',
          }}
        >
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
          <Button
            type='button'
            variant='bare'
            onClick={onNavigateToChat}
            style={{ marginTop: '4px', fontSize: '12px', fontWeight: 500, color: 'var(--color-primary)' }}
          >
            Continue conversation →
          </Button>
        </Surface>
      )}
    </Stack>
  );
};

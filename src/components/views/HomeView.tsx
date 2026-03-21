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
    <Stack className='h-full overflow-hidden' id='view-home' role='tabpanel' aria-labelledby='tab-home'>
      <Stack className='flex-1 overflow-y-auto p-3 gap-3'>
        {/* Centered greeting */}
        <Surface className='text-center pt-2'>
          <Text as='h2' size='lg' weight='semibold'>
            {config.widget_greeting ?? 'Hey There!'}
          </Text>
          <Text as='p' variant='muted' size='sm' className='mt-1'>
            {config.widget_body ?? 'How can I help you today?'}
          </Text>
        </Surface>

        {/* Ask a question CTA */}
        <Button
          type='button'
          onClick={onNavigateToChat}
          className='w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl font-medium bg-primary text-primary-foreground transition-opacity hover:opacity-95 shadow-sm'
          aria-label='Ask a question'
        >
          <Flex className='items-center gap-2'>
            <Icon name='chat' size={20} />
            Ask a question
          </Flex>
          <Icon name='chevronRight' size={16} />
        </Button>

        {/* Suggested action chips */}
        <Surface>
          <SuggestedActions
            actions={suggestedActions}
            hasPendingMessage={false}
            settings={{
              widget_secondary_color: config.widget_secondary_color ?? '#f3f4f6',
              widget_text_color: config.widget_text_color ?? '#1f2937',
            }}
            onActionClick={handleActionClick}
          />
        </Surface>

        {/* Recent conversation preview */}
        {messages.length > 0 && (
          <Surface className='px-3 py-2 rounded-lg border border-border bg-background/60'>
            <Text as='p' size='sm' weight='semibold' className='mb-0.5'>
              Recent conversation
            </Text>
            <Text as='p' size='xs' variant='muted' className='line-clamp-2'>
              {messages[messages.length - 1].content || 'Message'}
            </Text>
            <Button type='button' onClick={onNavigateToChat} className='mt-1 text-xs font-medium text-primary'>
              Continue conversation →
            </Button>
          </Surface>
        )}
      </Stack>
    </Stack>
  );
};

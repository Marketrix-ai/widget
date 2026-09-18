/**
 * `HomeView` — the opening screen: tenant greeting and body, the Ask-a-question button that switches to
 * the chat view, the suggested-action chips (`getSuggestedActionsFromConfig`), which navigate and dispatch
 * in one click, and a card linking back into a chat already in progress.
 *
 * Chip captions render VERBATIM in the tenant text colour: a `show`/`do` caption doubles as the
 * instruction dispatched on click and is given its mode prefix in the config layer, so prefixing here
 * would double it.
 */
import React from 'react';

import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import { messageText } from '../../types';
import { getSuggestedActionsFromConfig, type SuggestedActionItem } from '../../utils/suggestedActions';
import { Button } from '../base/Button';
import { Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

interface HomeViewProps {
  onNavigateToChat: () => void;
  onChipClick: (action: SuggestedActionItem) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigateToChat, onChipClick }) => {
  const config = useWidgetConfig();
  const { messages } = useWidget().state;
  const suggestedActions = getSuggestedActionsFromConfig(config);
  const lastMessagePreview = messageText(messages[messages.length - 1]?.parts ?? []) || 'Message';

  const handleActionClick = async (action: SuggestedActionItem, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onNavigateToChat();
    onChipClick(action);
  };

  return (
    <Stack height='full' overflow='hidden'>
      <Stack grow overflowY='auto' padding='lg'>
        <Surface style={{ textAlign: 'center', paddingTop: '8px', paddingBottom: '16px' }}>
          <Text as='h2' size='lg' weight='semibold'>
            {config.widget_greeting}
          </Text>
          <Text as='p' variant='muted' size='sm' style={{ marginTop: '2px' }}>
            {config.widget_body}
          </Text>
        </Surface>

        <Stack gap='sm'>
          <Button
            variant='primary'
            full
            onClick={onNavigateToChat}
            style={{
              paddingTop: '10px',
              paddingBottom: '10px',
            }}
          >
            <Icon name='chat' size={16} />
            Ask a question
          </Button>

          {suggestedActions.map(action => (
            <Button
              key={action.id}
              elevation='card'
              size='sm'
              variant='chip'
              full
              onClick={e => handleActionClick(action, e)}
              style={{ color: config.widget_text_color, paddingTop: '8px', paddingBottom: '8px' }}
            >
              <Text as='span' weight='normal' leading='tight'>
                {action.text}
              </Text>
            </Button>
          ))}
        </Stack>
      </Stack>

      {messages.length > 0 && (
        <Surface variant='floatingCard'>
          <Text as='p' size='xs' weight='semibold' style={{ marginBottom: '2px' }}>
            Recent chat
          </Text>
          <Text
            as='p'
            size='xs'
            variant='muted'
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {lastMessagePreview}
          </Text>
          <Button variant='bare' onClick={onNavigateToChat} style={{ marginTop: '4px' }}>
            <Text as='span' size='xs' variant='muted'>
              Continue chat →
            </Text>
          </Button>
        </Surface>
      )}
    </Stack>
  );
};

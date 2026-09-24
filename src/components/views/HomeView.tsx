/**
 * `HomeView` — the opening screen: tenant greeting and body, the Ask-a-question button that switches to
 * the chat view, the suggested-action chips, which navigate and dispatch in one click, and a card linking
 * back into a chat in progress. Chip captions render verbatim; `suggestedActions.ts` owns their prefix.
 */
import React from 'react';

import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import { messageText } from '../../utils/chat';
import { getSuggestedActionsFromConfig, type SuggestedActionItem } from '../../utils/suggestedActions';
import { Button } from '../base/Button';
import { Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

export const HomeView: React.FC = () => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { messages, isComposerLocked } = state;
  const suggestedActions = getSuggestedActionsFromConfig(config);
  const lastMessagePreview = messageText(messages[messages.length - 1]?.parts ?? []) || 'Message';
  const onNavigateToChat = () => actions.setActiveView('chat');
  const onChipClick = (action: SuggestedActionItem) => {
    actions.setActiveView('chat');
    actions.setMode(action.type);
    void actions.sendTurn(action.text, action.type);
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
              disabled={isComposerLocked}
              onClick={() => onChipClick(action)}
              style={{ color: config.widget_text_color, paddingTop: '8px', paddingBottom: '8px' }}
            >
              <Text as='span' weight='normal' tight>
                {action.text}
              </Text>
            </Button>
          ))}
        </Stack>
      </Stack>

      {messages.length > 0 && (
        <Surface floatingCard>
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

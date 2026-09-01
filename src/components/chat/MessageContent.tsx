import React from 'react';

import { useWidget } from '../../hooks/useWidget';
import type { ChatMessage } from '../../types';
import { filterCancellationText } from '../../utils/chat';
import { Flex } from '../base/Flex';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageContentProps {
  message: ChatMessage;
  isLastMessage: boolean;
}

export const MessageContent: React.FC<MessageContentProps> = ({ message, isLastMessage }) => {
  const { isTaskRunning } = useWidget().state;
  const isWaitingForUser = message.placeholderState === 'waiting-for-user';
  const showThinking = isTaskRunning && isLastMessage && (message.mode === 'show' || message.mode === 'do');

  if (message.parts.length > 0) {
    return (
      <Stack gap='sm'>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            const text = filterCancellationText(part.content);
            if (!text) return null;
            return (
              <Text
                as='div'
                key={`part-${index}`}
                size='sm'
                weight='medium'
                style={{
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  marginBottom: '4px',
                }}
              >
                {text}
              </Text>
            );
          } else if (part.type === 'progress') {
            return (
              <Flex key={`part-${index}`} align='start' gap='md'>
                <Text as='span' size='xs' weight='medium' style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                  {part.content}
                </Text>
              </Flex>
            );
          }
          return null;
        })}

        {((message.isPlaceholder && !message.parts.some(p => p.type === 'text')) || showThinking) && (
          <ThinkingIndicator isWaitingForUser={isWaitingForUser} />
        )}
      </Stack>
    );
  }

  if (message.isPlaceholder || (isTaskRunning && isLastMessage && (message.mode === 'show' || message.mode === 'do'))) {
    return <ThinkingIndicator isWaitingForUser={isWaitingForUser} />;
  }

  if (message.content) {
    return (
      <Text as='div' size='sm' weight='medium' style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        {message.content}
      </Text>
    );
  }

  return <Surface />;
};

import React from 'react';

import { useWidget } from '../../hooks/useWidget';
import type { ChatMessage } from '../../types';
import { removeThinkingMarkerFromEnd } from '../../utils/chat';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ProgressLine } from './ProgressLine';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageContentProps {
  message: ChatMessage;
  isLastMessage: boolean;
}

export const MessageContent: React.FC<MessageContentProps> = ({ message, isLastMessage }) => {
  const { state: widgetState } = useWidget();
  const placeholderState = message.placeholderState || 'thinking';
  const isWaitingForUser = placeholderState === 'waiting-for-user';

  if (message.parts && message.parts.length > 0) {
    return (
      <Stack gap='sm'>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            let text = removeThinkingMarkerFromEnd(part.content).trim();
            text = text
              .replace(/\(Cancelled by cleanup\)/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
            if (!text) return null;
            return (
              <Text
                as='div'
                key={`part-${index}`}
                size='sm'
                weight='medium'
                style={{
                  lineHeight: 'tight',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  marginBottom: '4px',
                }}
              >
                {text}
              </Text>
            );
          } else if (part.type === 'progress') {
            if (part.browserToolName === 'done' && message.taskStatus === 'done') {
              return null;
            }

            return (
              <ProgressLine
                key={`part-${index}`}
                content={part.content}
                status={part.status || 'in_progress'}
                {...(part.hideIcon !== undefined ? { hideIcon: part.hideIcon } : {})}
                {...(part.textStyle !== undefined ? { textStyle: part.textStyle } : {})}
              />
            );
          }
          return null;
        })}

        {((message.isPlaceholder && !message.parts.some(p => p.type === 'text')) ||
          (widgetState.isTaskRunning && isLastMessage && (message.mode === 'show' || message.mode === 'do'))) && (
          <ThinkingIndicator isWaitingForUser={isWaitingForUser} />
        )}
      </Stack>
    );
  }

  if (
    message.isPlaceholder ||
    (widgetState.isTaskRunning && isLastMessage && (message.mode === 'show' || message.mode === 'do'))
  ) {
    return <ThinkingIndicator isWaitingForUser={isWaitingForUser} />;
  }

  if (message.content) {
    return (
      <Text
        as='div'
        size='sm'
        weight='medium'
        style={{ lineHeight: 'tight', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
      >
        {message.content}
      </Text>
    );
  }

  return <Surface />;
};

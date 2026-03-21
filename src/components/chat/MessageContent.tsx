import React from 'react';

import type { ChatMessage, WidgetState } from '../../types';
import { removeThinkingMarkerFromEnd } from '../../utils/chat';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { ProgressLine } from './ProgressLine';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageContentProps {
  message: ChatMessage;
  isLastMessage: boolean;
  widgetState: WidgetState;
  accentColor: string;
  textColor: string;
}

export const MessageContent: React.FC<MessageContentProps> = ({
  message,
  isLastMessage,
  widgetState,
  accentColor,
  textColor,
}) => {
  const placeholderState = message.placeholderState || 'thinking';
  const isWaitingForUser = placeholderState === 'waiting-for-user';
  const customText = undefined;

  // Render using structured parts
  if (message.parts && message.parts.length > 0) {
    return (
      <Stack className='gap-1.5'>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            // Clean thinking marker if present in text part
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
                className='text-xs font-inter font-medium leading-tight break-words whitespace-pre-wrap mb-1'
              >
                {text}
              </Text>
            );
          } else if (part.type === 'progress') {
            // Hide progress line for "done" tool when task is completed (show icon instead)
            if (part.toolName === 'done' && message.taskStatus === 'done') {
              return null;
            }

            const isPending = part.status === 'running' || !part.status;

            // For waiting state:
            const isWaitingForUserAction =
              isWaitingForUser ||
              (isPending && widgetState.isTaskRunning && (message.mode === 'show' || message.mode === 'do'));

            return (
              <ProgressLine
                key={`part-${index}`}
                content={part.content}
                status={part.status || 'running'}
                isWaitingForUser={isWaitingForUserAction}
                accentColor={accentColor}
                textColor={textColor}
                {...(part.hideIcon !== undefined ? { hideIcon: part.hideIcon } : {})}
                {...(part.textStyle !== undefined ? { textStyle: part.textStyle } : {})}
              />
            );
          }
          return null;
        })}

        {/* Show thinking/waiting indicator at the bottom if task is running or it's a placeholder */}
        {((message.isPlaceholder && !message.parts.some(p => p.type === 'text')) ||
          (widgetState.isTaskRunning && isLastMessage && (message.mode === 'show' || message.mode === 'do'))) && (
          <ThinkingIndicator
            isWaitingForUser={isWaitingForUser}
            textColor={textColor}
            {...(customText !== undefined ? { customText } : {})}
            accentColor={accentColor}
          />
        )}
      </Stack>
    );
  }

  // Default empty state or if pure placeholder
  if (
    message.isPlaceholder ||
    (widgetState.isTaskRunning && isLastMessage && (message.mode === 'show' || message.mode === 'do'))
  ) {
    return (
      <ThinkingIndicator
        isWaitingForUser={isWaitingForUser}
        textColor={textColor}
        {...(customText !== undefined ? { customText } : {})}
        accentColor={accentColor}
      />
    );
  }

  return <Surface />;
};

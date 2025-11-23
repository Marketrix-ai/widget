import React from 'react';

import type { ChatMessage, WidgetState } from '../../types';
import { removeThinkingMarkerFromEnd } from '../../utils/chat';
import { ProgressLine } from './ProgressLine';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageContentProps {
  message: ChatMessage;
  widgetState: WidgetState;
  accentColor: string;
  textColor: string;
}

export const MessageContent: React.FC<MessageContentProps> = ({
  message,
  widgetState,
  accentColor,
  textColor,
}) => {
  const placeholderState = message.placeholderState || 'thinking';
  const isWaitingForUser = placeholderState === 'waiting-for-user';

  // Render using structured parts
  if (message.parts && message.parts.length > 0) {
    return (
      <div className='flex flex-col gap-1.5'>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            // Clean thinking marker if present in text part
            const text = removeThinkingMarkerFromEnd(part.content).trim();
            if (!text) return null;
            return (
              <div
                key={`part-${index}`}
                className='text-xs font-inter font-medium leading-tight break-words whitespace-pre-wrap mb-1'
              >
                {text}
              </div>
            );
          } else if (part.type === 'progress') {
            const isPending = part.status === 'running' || !part.status;

            // For waiting state:
            const isWaitingForUserAction =
              isWaitingForUser ||
              (isPending &&
                widgetState.isTaskRunning &&
                (message.mode === 'show' || message.mode === 'do'));

            return (
              <ProgressLine
                key={`part-${index}`}
                content={part.content}
                status={part.status || 'running'}
                isWaitingForUser={isWaitingForUserAction}
                accentColor={accentColor}
                textColor={textColor}
              />
            );
          }
          return null;
        })}

        {/* Show thinking/waiting indicator at the bottom if task is running or it's a placeholder */}
        {(message.isPlaceholder || widgetState.isTaskRunning) && (
          <ThinkingIndicator isWaitingForUser={isWaitingForUser} textColor={textColor} />
        )}
      </div>
    );
  }

  // Default empty state or if pure placeholder
  if (message.isPlaceholder || widgetState.isTaskRunning) {
    return <ThinkingIndicator isWaitingForUser={isWaitingForUser} textColor={textColor} />;
  }

  return <div />;
};

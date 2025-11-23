import React from 'react';

import type { ChatMessage, ProgressStep, WidgetState } from '../../types';
import { parseProgressSteps, removeThinkingMarkerFromEnd } from '../../utils/messageContentUtils';
import { ProgressLine } from './progressLine';
import { ThinkingIndicator } from './thinkingIndicator';

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

  // 1. Try to use parts (New Structure)
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
            const isPending = part.status === 'running' || !part.status; // default to running/pending if undefined or 'running'
            // For waiting state:
            // If message is placeholder and waiting state -> global waiting
            // OR if specific step is running/pending and task is running in interactive mode
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
        {/* Only show if we have some content or if it's a pure placeholder waiting to start */}
        {(message.isPlaceholder || widgetState.isTaskRunning) && (
          <ThinkingIndicator isWaitingForUser={isWaitingForUser} textColor={textColor} />
        )}
      </div>
    );
  }

  // 2. Fallback to Legacy Logic (progressSteps + content string)
  let mainContent = message.content;
  let progressSteps: ProgressStep[] = message.progressSteps || [];

  // Fallback for legacy messages that haven't been migrated yet and don't have progressSteps structure
  if (!message.progressSteps && (message.content.includes('○') || message.content.includes('●✓'))) {
    const parsed = parseProgressSteps(message.content);
    mainContent = parsed.mainContent;
    progressSteps = parsed.progressSteps;
  }

  // Clean thinking marker for display
  mainContent = removeThinkingMarkerFromEnd(mainContent).trim();
  const hasContent = mainContent.length > 0 || progressSteps.length > 0;

  const renderLegacyProgressSteps = () => {
    if (progressSteps.length === 0) return null;

    return (
      <div className='flex flex-col gap-1 mt-2'>
        {progressSteps.map((step, idx) => {
          const isPending = step.status === 'pending';
          const isWaitingForUserAction =
            isWaitingForUser ||
            (isPending &&
              widgetState.isTaskRunning &&
              (message.mode === 'show' || message.mode === 'do'));

          const lineText = step.explanation || `Executing ${step.tool}...`;
          // Map legacy status to new status
          const status = step.status === 'pending' ? 'running' : step.status;

          return (
            <ProgressLine
              key={idx}
              content={lineText}
              status={status}
              isWaitingForUser={isWaitingForUserAction}
              accentColor={accentColor}
              textColor={textColor}
            />
          );
        })}
      </div>
    );
  };

  if (message.isPlaceholder) {
    return (
      <div className='flex flex-col gap-1.5'>
        {/* Show main content if available */}
        {mainContent && (
          <div className='text-xs font-inter font-medium leading-tight break-words whitespace-pre-wrap mb-2'>
            {mainContent}
          </div>
        )}

        {/* Show progress lines */}
        {renderLegacyProgressSteps()}

        {/* Show thinking/waiting indicator */}
        {(!hasContent || (progressSteps.length > 0 && !mainContent) || mainContent) && (
          <ThinkingIndicator isWaitingForUser={isWaitingForUser} textColor={textColor} />
        )}
      </div>
    );
  }

  // Non-placeholder message (Legacy)
  return (
    <div className='text-xs font-inter font-medium leading-tight break-words'>
      {/* Main content */}
      {mainContent && <div className='whitespace-pre-wrap mb-2'>{mainContent}</div>}

      {/* Progress lines */}
      {renderLegacyProgressSteps()}

      {!mainContent && progressSteps.length === 0 && <div>No content available</div>}
    </div>
  );
};

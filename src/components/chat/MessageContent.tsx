import React from 'react';

import type { ChatMessage, WidgetState } from '../../types';
import { parseProgressLines, removeThinkingMarkerFromEnd } from '../../utils/messageContentUtils';
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
  const cleanContent = removeThinkingMarkerFromEnd(message.content);
  const { mainContent, progressLines } = parseProgressLines(cleanContent);
  const placeholderState = message.placeholderState || 'thinking';
  const isWaitingForUser = placeholderState === 'waiting-for-user';
  const hasContent = mainContent.trim().length > 0 || progressLines.length > 0;

  // Debug logging for progress display
  if (message.isPlaceholder) {
    console.log('[MessageContent] [FLOW] Rendering placeholder message', {
      messageId: message.id,
      progressLineCount: progressLines.length,
      mainContentLength: mainContent.trim().length,
      hasContent,
      placeholderState,
      isWaitingForUser,
      contentPreview: message.content.substring(0, 200),
      fullContent: message.content,
      parsedProgressLines: progressLines,
      willShowProgressLines: progressLines.length > 0,
      willShowThinking: !hasContent || (progressLines.length > 0 && !mainContent) || mainContent,
    });
  }

  if (message.isPlaceholder) {
    return (
      <div className='flex flex-col gap-1.5'>
        {/* Show main content if available */}
        {mainContent && (
          <div className='text-xs font-inter font-medium leading-tight break-words whitespace-pre-wrap mb-2'>
            {mainContent}
          </div>
        )}

        {/* Show progress lines if available */}
        {progressLines.length > 0 && (
          <div className='flex flex-col gap-1 mt-2'>
            {progressLines.map((line, idx) => {
              const trimmedLine = line.trim();
              const isPending = trimmedLine.startsWith('○');
              const isWaitingForUserAction =
                isWaitingForUser ||
                (isPending &&
                  widgetState.isTaskRunning &&
                  (message.mode === 'show' || message.mode === 'do'));

              return (
                <ProgressLine
                  key={idx}
                  line={line}
                  isWaitingForUser={isWaitingForUserAction}
                  accentColor={accentColor}
                  textColor={textColor}
                />
              );
            })}
          </div>
        )}

        {/* Show thinking/waiting indicator when:
            - No content at all (no main content and no progress lines), OR
            - Has progress lines but no main content (still processing), OR
            - Has main content (show indicator after content)
            This ensures progress lines are always visible and thinking indicator doesn't hide them */}
        {(!hasContent || (progressLines.length > 0 && !mainContent) || mainContent) && (
          <ThinkingIndicator isWaitingForUser={isWaitingForUser} textColor={textColor} />
        )}
      </div>
    );
  }

  // Non-placeholder message
  return (
    <div className='text-xs font-inter font-medium leading-tight break-words'>
      {/* Main content */}
      {mainContent && <div className='whitespace-pre-wrap mb-2'>{mainContent}</div>}
      {/* Progress lines with icons */}
      {progressLines.length > 0 && (
        <div className='flex flex-col gap-1 mt-2'>
          {progressLines.map((line, idx) => {
            const trimmedLine = line.trim();
            const isPending = trimmedLine.startsWith('○');
            const isWaitingForUserAction =
              isPending &&
              widgetState.isTaskRunning &&
              (message.mode === 'show' || message.mode === 'do');

            return (
              <ProgressLine
                key={idx}
                line={line}
                isWaitingForUser={isWaitingForUserAction}
                accentColor={accentColor}
                textColor={textColor}
              />
            );
          })}
        </div>
      )}
      {!mainContent && progressLines.length === 0 && <div>No content available</div>}
    </div>
  );
};

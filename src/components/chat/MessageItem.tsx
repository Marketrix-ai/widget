import React from 'react';

import { DARK_THEME_CLASSES } from '../../constants/theme';
import type { ChatMessage, WidgetState } from '../../types';
import { addOpacity, formatMessageTime, getContrastingColor } from '../../utils/format';
import { MessageContent } from './MessageContent';
import { TaskStatusIcon } from './TaskStatusIcon';
import { VideoStreamDisplay } from './VideoStreamDisplay';

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  isLastMessage: boolean;
  widgetState: WidgetState;
  settings: {
    widget_accent_color: string;
    widget_text_color: string;
    widget_border_color: string;
    widget_shadow: string;
    widget_border_radius: string;
  };
  marketrixIcon: string;
  onScreenAccessAllow?: () => void;
  onScreenAccessDeny?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  index,
  isLastMessage,
  widgetState,
  settings,
  marketrixIcon,
  onScreenAccessAllow,
  onScreenAccessDeny,
}) => {
  // Render system messages differently (muted, centered)
  if (message.isSystemMessage) {
    return (
      <div key={`message-${message.id}-${index}`} className='flex justify-center items-center py-0'>
        <span className='text-[10px] font-inter font-normal' style={{ color: `${settings.widget_text_color}99` }}>
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.sender === 'user';

  return (
    <div key={`message-${message.id}-${index}`} className='group flex flex-col mt-[10px]'>
      <div className='flex items-start gap-1 w-full flex-row'>
        {/* Logo or Spacer - Always on left */}
        <div
          className='flex-shrink-0 agent-logo-img-container'
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'transparent',
          }}
        >
          {!isUser && (
            <img
              src={marketrixIcon}
              alt='Marketrix AI'
              className='agent-logo-img'
              style={{
                width: '32px',
                height: '32px',
                boxShadow: settings.widget_shadow,
                borderRadius: settings.widget_border_radius,
                border: 'none',
                outline: 'none',
                display: 'block',
                objectFit: 'cover',
                backgroundColor: 'transparent',
              }}
            />
          )}
        </div>

        {/* Message bubble */}
        <div
          className={`flex flex-col flex-1 relative
          ${message.videoStream ? 'p-0' : 'px-2.5 py-2'} shadow-sm border ${!isUser ? 'bg-white' : ''}
          ${isUser ? 'rounded-l-lg rounded-tr-lg rounded-br-lg' : 'rounded-r-lg rounded-tl-lg rounded-bl-lg'}
        `}
          style={{
            backgroundColor: isUser ? settings.widget_accent_color : undefined,
            color: isUser ? getContrastingColor(settings.widget_accent_color) : settings.widget_text_color,
            borderColor: isUser ? settings.widget_accent_color : settings.widget_border_color,
            maxWidth: 'calc(100% - 40px)', // Leave space for logo space on left
          }}
        >
          {/* Video stream display - edge-to-edge */}
          {message.videoStream && <VideoStreamDisplay stream={message.videoStream} isUserMessage={isUser} />}
          {/* Message content */}
          {!message.videoStream && (
            <MessageContent
              message={message}
              isLastMessage={isLastMessage}
              widgetState={widgetState}
              accentColor={settings.widget_accent_color}
              textColor={isUser ? getContrastingColor(settings.widget_accent_color) : settings.widget_text_color}
            />
          )}

          {/* Screen access request action buttons - show if not yet handled */}
          {message.isScreenAccessRequest && !message.screenShareStatus && (
            <div className='mt-1.5 pt-0.5 flex gap-2'>
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onScreenAccessAllow?.();
                }}
                className={DARK_THEME_CLASSES.allowButton}
                style={{
                  width: '65px',
                  height: '26px',
                  borderRadius: '22px',
                }}
              >
                <span className='text-xs font-medium'>Yes</span>
              </button>
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onScreenAccessDeny?.();
                }}
                className={DARK_THEME_CLASSES.denyButton}
                style={{
                  width: '65px',
                  height: '26px',
                  borderRadius: '22px',
                }}
              >
                <span className='text-xs font-medium'>No</span>
              </button>
            </div>
          )}

          {/* Screen access request handled state - show decision */}
          {message.isScreenAccessRequest && message.screenShareStatus === 'allowed' && (
            <div
              className='mt-0.5 text-xs font-medium italic'
              style={{ color: addOpacity(settings.widget_text_color, 0.5) }}
            >
              Sure
            </div>
          )}
          {message.isScreenAccessRequest && message.screenShareStatus === 'denied' && (
            <div
              className='mt-0.5 text-xs font-medium italic'
              style={{ color: addOpacity(settings.widget_text_color, 0.5) }}
            >
              Check HTML Instead
            </div>
          )}

          {/* Task status icon at bottom right (only for agent messages with task status) */}
          {!isUser && message.taskStatus && (
            <div className='absolute bottom-1 right-1 flex items-center justify-center'>
              <TaskStatusIcon status={message.taskStatus} accentColor={settings.widget_accent_color} />
            </div>
          )}
        </div>
      </div>
      {/* Timestamp below card */}
      {!message.isPlaceholder && (
        <div className='flex justify-end mt-0.5 mr-1'>
          <span className='text-[10px] text-gray-400 font-inter font-normal'>
            {formatMessageTime(message.timestamp)}
          </span>
        </div>
      )}
    </div>
  );
};

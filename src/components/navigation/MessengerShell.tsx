import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useFocusTrap } from '../../hooks/useFocusTrap';
import { type ResizeCorner, useResize } from '../../hooks/useResize';
import { useWidget } from '../../hooks/useWidget';
import { createUserMessage } from '../../services/ChatService';
import type { ChatMessage, InstructionType, MarketrixConfig, TaskProgress, WidgetView } from '../../types';
import { addOpacity } from '../../utils/format';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { getPanelPositionStyle } from '../../utils/widgetPositioning';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
import { TabBar } from './TabBar';
import { ViewTransition } from './ViewTransition';

const TAB_ICONS = {
  home: (
    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={2}
        d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
      />
    </svg>
  ),
  chat: (
    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={2}
        d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
      />
    </svg>
  ),
  help: (
    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={2}
        d='M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
      />
    </svg>
  ),
};

export interface MessengerShellProps {
  config: MarketrixConfig;
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
  isTaskRunning?: boolean;
  taskProgress?: TaskProgress[];
  activeView: WidgetView;
  onClose: () => void;
  onSendMessage: (
    message: string,
    mode?: InstructionType,
    connectionId?: number,
    question?: string,
    skipUserMessage?: boolean,
  ) => void;
  onSetMode: (mode: InstructionType) => void;
  onAddMessage: (message: ChatMessage) => void;
  onUpdateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  onRemoveMessage?: (messageId: string) => void;
  onStopTask?: () => void;
  onClearChat?: () => void | Promise<void>;
  onScreenSharingChange?: (isSharing: boolean) => void;
  setActiveView: (view: WidgetView) => void;
}

export const MessengerShell: React.FC<MessengerShellProps> = ({
  config,
  isOpen,
  isMinimized,
  messages,
  currentMode,
  isTaskRunning = false,
  taskProgress = [],
  activeView,
  onClose,
  onSendMessage,
  onSetMode,
  onAddMessage,
  onUpdateMessage,
  onRemoveMessage,
  onStopTask,
  onClearChat,
  onScreenSharingChange,
  setActiveView,
}) => {
  const { config: settings, isPreviewMode } = useWidget({ config });
  const tenantId = useMemo(
    () => config.mtxId ?? (config.mtxApp != null ? String(config.mtxApp) : 'default'),
    [config.mtxId, config.mtxApp],
  );
  const { widthPx, heightPx, onResizeStart, containerRef } = useResize(
    settings.widget_width,
    settings.widget_height,
    tenantId,
    isMinimized,
    isPreviewMode,
  );

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [navDirection, setNavDirection] = useState<'forward' | 'back'>('forward');
  const prevViewRef = useRef<WidgetView>(activeView);
  useEffect(() => {
    if (prevViewRef.current !== activeView) {
      setNavDirection(activeView === 'chat' ? 'forward' : 'back');
      prevViewRef.current = activeView;
    }
  }, [activeView]);

  useFocusTrap(containerRef, isOpen, {
    onEscape: onClose,
    focusTargetRef: activeView === 'chat' ? messageInputRef : undefined,
  });

  const tabs = useMemo(
    () => [
      { id: 'home' as const, label: 'Home', icon: TAB_ICONS.home },
      { id: 'chat' as const, label: 'Chat', icon: TAB_ICONS.chat },
      { id: 'help' as const, label: 'Help', icon: TAB_ICONS.help },
    ],
    [],
  );

  const effectivePosition = settings.widget_position as 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right';
  const zIndex = settings.widget_position_z_index ?? 40;
  const panelPositionStyle = getPanelPositionStyle(effectivePosition);

  if (!isOpen) return null;

  const customStyles: React.CSSProperties = {
    width: widthPx,
    height: isMinimized ? '48px' : heightPx,
    borderRadius: settings.widget_border_radius,
    fontSize: settings.widget_font_size,
    backgroundColor: '#ffffff',
    backgroundImage: settings.widget_background_color.includes('gradient')
      ? settings.widget_background_color
      : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
    color: settings.widget_text_color,
    borderColor: settings.widget_border_color,
    boxShadow: settings.widget_shadow,
    zIndex,
  };

  const positionClass = isPreviewMode ? 'absolute' : 'fixed';
  const previewPositionStyle = isPreviewMode
    ? effectivePosition.includes('top')
      ? { top: '20px', ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }) }
      : { bottom: '20px', ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }) }
    : {};

  const transformOrigin =
    `${effectivePosition.includes('top') ? 'top' : 'bottom'} ${effectivePosition.includes('right') ? 'right' : 'left'}` as const;

  const handleViewChange = (view: WidgetView) => {
    setActiveView(view);
  };

  const handleNavigateToChat = () => {
    setNavDirection('forward');
    setActiveView('chat');
  };

  const handleChipClick = (action: SuggestedActionItem) => {
    onAddMessage(createUserMessage(action.text, action.type, 'chip-message'));
    onSetMode(action.type);
    onSendMessage(action.text, action.type, undefined, undefined, true);
  };

  return (
    <div
      className={`${positionClass} rounded-[var(--radius)] pointer-events-auto`}
      style={{
        zIndex,
        backgroundColor: '#ffffff',
        backgroundImage: settings.widget_background_color.includes('gradient')
          ? settings.widget_background_color
          : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
        ...(isPreviewMode ? previewPositionStyle : panelPositionStyle),
      }}
    >
      <div
        ref={containerRef}
        className='rounded-[var(--radius)] shadow-xl border flex flex-col relative overflow-hidden animate-messenger-entrance transform-gpu shadow-2xl'
        style={{
          transformOrigin,
          ...customStyles,
          scrollbarColor: `${addOpacity(settings.widget_border_color, 0.3)} ${addOpacity(settings.widget_border_color, 0.1)}`,
          scrollbarWidth: 'thin',
        }}
      >
        {isMinimized ? (
          <div
            className='flex items-center justify-between px-3 h-12 border-b'
            style={{ borderColor: settings.widget_border_color }}
          >
            <span className='text-sm font-medium' style={{ color: settings.widget_text_color }}>
              Marketrix
            </span>
            <button
              type='button'
              onClick={onClose}
              className='p-1.5 rounded-full opacity-60 hover:opacity-100'
              style={{ color: settings.widget_text_color }}
              aria-label='Close'
            >
              <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                <path
                  fillRule='evenodd'
                  d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                  clipRule='evenodd'
                />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className='flex-1 overflow-hidden flex flex-col min-h-0'>
              <ViewTransition key={activeView} direction={navDirection}>
                {activeView === 'home' && (
                  <HomeView
                    config={config}
                    messages={messages}
                    onNavigateToChat={handleNavigateToChat}
                    onChipClick={handleChipClick}
                  />
                )}
                {activeView === 'chat' && (
                  <ChatView
                    config={config}
                    messages={messages}
                    currentMode={currentMode}
                    isTaskRunning={isTaskRunning}
                    taskProgress={taskProgress}
                    onSendMessage={onSendMessage}
                    onSetMode={onSetMode}
                    onAddMessage={onAddMessage}
                    onUpdateMessage={onUpdateMessage}
                    onRemoveMessage={onRemoveMessage}
                    onStopTask={onStopTask}
                    onClearChat={onClearChat}
                    onClose={onClose}
                    onBack={() => {
                      setNavDirection('back');
                      setActiveView('home');
                    }}
                    onScreenSharingChange={onScreenSharingChange}
                    messageInputRef={messageInputRef}
                  />
                )}
                {activeView === 'help' && (
                  <div
                    id='view-help'
                    role='tabpanel'
                    aria-labelledby='tab-help'
                    className='flex items-center justify-center h-full p-4 text-sm opacity-70'
                    style={{ color: settings.widget_text_color }}
                  >
                    Help – coming soon
                  </div>
                )}
                {activeView === 'news' && (
                  <div
                    id='view-news'
                    role='tabpanel'
                    aria-labelledby='tab-news'
                    className='flex items-center justify-center h-full p-4 text-sm opacity-70'
                    style={{ color: settings.widget_text_color }}
                  >
                    News – coming soon
                  </div>
                )}
              </ViewTransition>
            </div>

            <TabBar
              activeView={activeView}
              onViewChange={handleViewChange}
              tabs={tabs}
              accentColor={settings.widget_accent_color ?? '#3b82f6'}
              textColor={settings.widget_text_color ?? '#1f2937'}
              borderColor={settings.widget_border_color ?? '#e5e7eb'}
            />
          </>
        )}

        {!isMinimized &&
          !isPreviewMode &&
          (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(corner => {
            const posClasses: Record<ResizeCorner, string> = {
              'top-left': 'top-0 left-0 rounded-tl-[var(--radius)] cursor-nwse-resize items-start justify-start',
              'top-right': 'top-0 right-0 rounded-tr-[var(--radius)] cursor-nesw-resize items-start justify-end',
              'bottom-left': 'bottom-0 left-0 rounded-bl-[var(--radius)] cursor-nesw-resize items-end justify-start',
              'bottom-right': 'bottom-0 right-0 rounded-br-[var(--radius)] cursor-nwse-resize items-end justify-end',
            };
            return (
              <div
                key={corner}
                role='separator'
                aria-label={`Resize widget from ${corner.replace('-', ' ')}`}
                title='Drag to resize'
                className={`absolute w-5 h-5 flex p-1 touch-none z-10 group ${posClasses[corner]}`}
                onMouseDown={onResizeStart(corner)}
              />
            );
          })}
      </div>
    </div>
  );
};

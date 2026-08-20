import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SHADOW } from '../../design-system/shadows';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useResize } from '../../hooks/useResize';
import { useWidget } from '../../hooks/useWidget';
import { createUserMessage } from '../../services/ChatService';
import type { ChatMessage, InstructionType, MarketrixConfig, WidgetView } from '../../types';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { getPanelPositionStyle } from '../../utils/widgetPositioning';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { HeaderBar } from '../blocks/HeaderBar';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
import { ResizeHandles } from './ResizeHandles';
import { ShellTabBar } from './ShellTabBar';

export interface MessengerShellProps {
  config: MarketrixConfig;
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  currentMode: InstructionType;
  isTaskRunning?: boolean;
  activeView: WidgetView;
  onClose: () => void;
  onSendMessage: (message: string, mode?: InstructionType, skipUserMessage?: boolean) => void;
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

  const effectivePosition = settings.widget_position as 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right';
  const zIndex = settings.widget_position_z_index ?? 40;
  const panelPositionStyle = getPanelPositionStyle(effectivePosition);

  // Must stay above the early return below.
  const [headerScreenSharing, setHeaderScreenSharing] = useState(false);
  const chatViewStartScreenShareRef = useRef<(() => void) | null>(null);
  const chatViewStopScreenShareRef = useRef<(() => void) | null>(null);

  const handleHeaderScreenSharingChange = useCallback(
    (isSharing: boolean) => {
      setHeaderScreenSharing(isSharing);
      onScreenSharingChange?.(isSharing);
    },
    [onScreenSharingChange],
  );

  if (!isOpen) return null;

  const backgroundImage = settings.widget_background_color.includes('gradient')
    ? settings.widget_background_color
    : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`;

  const customStyles: React.CSSProperties = {
    width: widthPx,
    height: isMinimized ? '48px' : heightPx,
    fontSize: settings.widget_font_size,
    backgroundImage,
    zIndex,
  };

  const positionClass = isPreviewMode ? 'absolute' : 'fixed';
  const transformOrigin =
    `${effectivePosition.includes('top') ? 'top' : 'bottom'} ${effectivePosition.includes('right') ? 'right' : 'left'}` as const;

  const handleNavigateToChat = () => {
    setNavDirection('forward');
    setActiveView('chat');
  };

  const handleChipClick = (action: SuggestedActionItem) => {
    onAddMessage(createUserMessage(action.text, action.type, 'chip-message'));
    onSetMode(action.type);
    onSendMessage(action.text, action.type, true);
  };

  const screenShareHandler =
    activeView === 'chat' && config.use_screenshare !== false
      ? () => {
          if (headerScreenSharing) {
            chatViewStopScreenShareRef.current?.();
          } else {
            chatViewStartScreenShareRef.current?.();
          }
        }
      : undefined;

  return (
    <Stack
      ref={containerRef}
      position={positionClass as 'fixed' | 'absolute'}
      rounded='theme'
      border
      overflow='hidden'
      style={{
        zIndex,
        backgroundImage,
        transformOrigin,
        ...customStyles,
        ...panelPositionStyle,
        pointerEvents: 'auto',
        scrollbarWidth: 'thin',
        animation: 'messenger-entrance 300ms cubic-bezier(0, 1.2, 1, 1)',
        boxShadow: SHADOW.panel,
      }}
    >
      <HeaderBar
        title={config.widget_header ?? 'AI Agent'}
        subtitle={isMinimized ? undefined : (config.widget_body ?? 'How can I help?')}
        minimized={isMinimized}
        onClose={onClose}
        controls={
          screenShareHandler && (
            <IconButton
              variant='ghost'
              size='sm'
              label={headerScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
              onClick={screenShareHandler}
            >
              {headerScreenSharing && (
                <span className='absolute top-0.5 right-0.5 inline-flex h-1.5 w-1.5'>
                  <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75' />
                  <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-current' />
                </span>
              )}
              <Icon name='screenShare' size={16} />
            </IconButton>
          )
        }
      />

      {!isMinimized && (
        <>
          <Surface grow overflow='hidden' style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Surface
              key={activeView}
              data-view-transition
              data-direction={navDirection}
              style={{ width: '100%', height: '100%' }}
            >
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
                  onSendMessage={onSendMessage}
                  onSetMode={onSetMode}
                  onAddMessage={onAddMessage}
                  onUpdateMessage={onUpdateMessage}
                  onRemoveMessage={onRemoveMessage}
                  onStopTask={onStopTask}
                  onClearChat={onClearChat}
                  onScreenSharingChange={handleHeaderScreenSharingChange}
                  onStartScreenShareRef={chatViewStartScreenShareRef}
                  onStopScreenShareRef={chatViewStopScreenShareRef}
                  messageInputRef={messageInputRef}
                />
              )}
            </Surface>
          </Surface>

          <ShellTabBar activeView={activeView} onChange={setActiveView} />
        </>
      )}

      {!isMinimized && !isPreviewMode && <ResizeHandles onResizeStart={onResizeStart} />}
    </Stack>
  );
};

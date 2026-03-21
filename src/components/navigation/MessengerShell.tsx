import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import packageJson from '../../../package.json';
import { SHADOW } from '../../design-system/shadows';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useResize } from '../../hooks/useResize';
import { useWidget } from '../../hooks/useWidget';
import { createUserMessage } from '../../services/ChatService';
import { configManager } from '../../services/ConfigManager';
import { sessionManager } from '../../services/SessionManager';
import { StreamClient } from '../../services/StreamClient';
import type { ChatMessage, InstructionType, MarketrixConfig, TaskProgress, WidgetView } from '../../types';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { getPanelPositionStyle } from '../../utils/widgetPositioning';
import { Badge } from '../base/Badge';
import { Card } from '../base/Card';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { HeaderBar } from '../blocks/HeaderBar';
import { TabBar } from '../blocks/TabBar';
import { DiagnosticModal } from '../ui/DiagnosticModal';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
import { ViewTransition } from './ViewTransition';

const TAB_DEFS = [
  { id: 'home' as const, icon: 'home' as const, label: 'Home' },
  { id: 'chat' as const, icon: 'chat' as const, label: 'Chat' },
  { id: 'help' as const, icon: 'help' as const, label: 'Help' },
];

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
    applicationId?: number,
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

  const effectivePosition = settings.widget_position as 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right';
  const zIndex = settings.widget_position_z_index ?? 40;
  const panelPositionStyle = getPanelPositionStyle(effectivePosition);

  // All hooks must be above the early return — React requires stable hook count.
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
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
  const previewPositionStyle = isPreviewMode
    ? effectivePosition.includes('top')
      ? { top: '20px', ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }) }
      : { bottom: '20px', ...(effectivePosition.includes('right') ? { right: '20px' } : { left: '20px' }) }
    : {};

  const transformOrigin =
    `${effectivePosition.includes('top') ? 'top' : 'bottom'} ${effectivePosition.includes('right') ? 'right' : 'left'}` as const;

  const handleViewChange = (view: string) => {
    setActiveView(view as WidgetView);
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
        ...(isPreviewMode ? previewPositionStyle : panelPositionStyle),
        pointerEvents: 'auto',
        scrollbarWidth: 'thin',
        animation: 'messenger-entrance 300ms cubic-bezier(0, 1.2, 1, 1)',
        boxShadow: SHADOW.panel,
      }}
    >
      <HeaderBar
        title={config.agent_name ?? 'AI Agent'}
        subtitle={isMinimized ? undefined : (config.agent_description ?? 'How can I help?')}
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
              {headerScreenSharing && <Badge variant='live' className='absolute top-0.5 right-0.5' />}
              <Icon name='screenShare' size={16} />
            </IconButton>
          )
        }
      />

      {!isMinimized && (
        <>
          <Surface grow overflow='hidden' style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
                  onScreenSharingChange={handleHeaderScreenSharingChange}
                  onStartScreenShareRef={chatViewStartScreenShareRef}
                  onStopScreenShareRef={chatViewStopScreenShareRef}
                  messageInputRef={messageInputRef}
                />
              )}
              {activeView === 'help' && (
                <Stack id='view-help' role='tabpanel' aria-labelledby='tab-help' height='full' padding='lg'>
                  <Stack grow align='center' justify='center' gap='sm'>
                    <Icon name='help' size={32} className='text-foreground-faint' />
                    <Text size='sm' variant='muted'>
                      Help – coming soon
                    </Text>
                  </Stack>
                  <Card style={{ margin: '0 0 4px 0' }}>
                    <Text size='xs' variant='faint' style={{ display: 'block' }}>
                      Widget v{packageJson.version}
                    </Text>
                    <Text size='xs' variant='faint' style={{ display: 'block' }}>
                      API{' '}
                      {(() => {
                        try {
                          const status = StreamClient.getInstance().getStatus();
                          return status === 'connected' ? 'connected' : 'disconnected';
                        } catch {
                          return '—';
                        }
                      })()}
                    </Text>
                  </Card>
                </Stack>
              )}
              {activeView === 'news' && (
                <Stack
                  id='view-news'
                  role='tabpanel'
                  aria-labelledby='tab-news'
                  height='full'
                  align='center'
                  justify='center'
                  gap='sm'
                  padding='lg'
                >
                  <Icon name='info' size={32} className='text-foreground-faint' />
                  <Text size='sm' variant='muted'>
                    News – coming soon
                  </Text>
                </Stack>
              )}
            </ViewTransition>
          </Surface>

          <TabBar tabs={TAB_DEFS} active={activeView} onChange={handleViewChange} />
        </>
      )}

      {!isMinimized &&
        !isPreviewMode &&
        (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(corner => {
          const isTop = corner.startsWith('top');
          const isLeft = corner.endsWith('left');
          const cornerStyle: React.CSSProperties = {
            position: 'absolute',
            width: '20px',
            height: '20px',
            padding: '4px',
            touchAction: 'none',
            zIndex: 10,
            display: 'flex',
            alignItems: isTop ? 'flex-start' : 'flex-end',
            justifyContent: isLeft ? 'flex-start' : 'flex-end',
            cursor: (isTop && isLeft) || (!isTop && !isLeft) ? 'nwse-resize' : 'nesw-resize',
            top: isTop ? 0 : undefined,
            bottom: isTop ? undefined : 0,
            left: isLeft ? 0 : undefined,
            right: isLeft ? undefined : 0,
          };
          return (
            <div
              key={corner}
              role='separator'
              aria-label={`Resize widget from ${corner.replace('-', ' ')}`}
              title='Drag to resize'
              style={cornerStyle}
              onMouseDown={onResizeStart(corner)}
            />
          );
        })}
      <DiagnosticModal
        isOpen={diagnosticOpen}
        onClose={() => setDiagnosticOpen(false)}
        diagnosticData={{
          chatId: sessionManager.getChatId(),
          streamEndpoint: (() => {
            const apiHost = configManager.getConfig()?.mtxApiHost || config.mtxApiHost;
            return apiHost ? `${apiHost.replace(/\/$/, '')}/widget/stream` : null;
          })(),
          connectionStatus: (() => {
            try {
              return StreamClient.getInstance().getStatus();
            } catch {
              return 'disconnected';
            }
          })(),
          applicationId: configManager.getConfig()?.mtxApp,
          agentId: configManager.getConfig()?.mtxAgent,
          version: packageJson.version,
          build: typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev',
        }}
      />
    </Stack>
  );
};

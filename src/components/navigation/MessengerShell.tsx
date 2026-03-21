import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiInfo, FiTrash2 } from 'react-icons/fi';

import packageJson from '../../../package.json';
import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { type ResizeCorner, useResize } from '../../hooks/useResize';
import { useWidget } from '../../hooks/useWidget';
import { createUserMessage } from '../../services/ChatService';
import { configManager } from '../../services/ConfigManager';
import { sessionManager } from '../../services/SessionManager';
import { StreamClient } from '../../services/StreamClient';
import type { ChatMessage, InstructionType, MarketrixConfig, TaskProgress, WidgetView } from '../../types';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { getPanelPositionStyle } from '../../utils/widgetPositioning';
import { Avatar } from '../base/Avatar';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { DiagnosticModal } from '../ui/DiagnosticModal';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
import { TabBar } from './TabBar';
import { ViewTransition } from './ViewTransition';

const TAB_ICONS = {
  home: <Icon name='home' size={20} />,
  chat: <Icon name='chat' size={20} />,
  help: <Icon name='help' size={20} />,
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

  // All hooks must be above the early return — React requires stable hook count.
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [headerScreenSharing, setHeaderScreenSharing] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const chatViewStartScreenShareRef = useRef<(() => void) | null>(null);
  const chatViewStopScreenShareRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.composedPath()[0] as Node;
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

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
    <Surface
      className={`${positionClass} rounded-[var(--radius)] pointer-events-auto`}
      style={{
        zIndex,
        backgroundImage,
        ...(isPreviewMode ? previewPositionStyle : panelPositionStyle),
      }}
    >
      <Stack
        ref={containerRef}
        className='rounded-[var(--radius)] shadow-[var(--shadow)] border border-border text-foreground relative overflow-hidden animate-messenger-entrance'
        style={{
          transformOrigin,
          ...customStyles,
          scrollbarWidth: 'thin',
        }}
      >
        {isMinimized ? (
          <Flex className='items-center justify-between px-3 h-10 border-b border-border'>
            <Text size='sm' weight='medium'>
              Marketrix
            </Text>
            <IconButton variant='ghost' size='sm' label='Close' onClick={onClose}>
              <Icon name='close' size={16} />
            </IconButton>
          </Flex>
        ) : (
          <>
            {/* Shared header: agent name + description */}
            <Flex className='justify-between items-center px-3 py-2 border-b border-border flex-shrink-0'>
              <Flex className='items-center gap-2 min-w-0 flex-1'>
                <Avatar
                  src={MarketrixIcon}
                  alt=''
                  size='md'
                  className='rounded-[var(--radius)] shadow-[var(--shadow)]'
                />
                <Stack className='min-w-0'>
                  <Text size='sm' weight='semibold' truncate className='leading-tight'>
                    {config.agent_name ?? 'AI Agent'}
                  </Text>
                  <Text as='p' size='xs' variant='muted' truncate>
                    {config.agent_description ?? 'How can I help?'}
                  </Text>
                </Stack>
              </Flex>
              <Flex className='items-center gap-0.5 flex-shrink-0'>
                {activeView === 'chat' && (
                  <>
                    {config.use_screenshare !== false && !headerScreenSharing && (
                      <IconButton
                        variant='ghost'
                        size='sm'
                        label='Start screen sharing'
                        onClick={() => chatViewStartScreenShareRef.current?.()}
                      >
                        <Icon name='screenShare' size={16} />
                      </IconButton>
                    )}
                    {headerScreenSharing && (
                      <IconButton
                        variant='ghost'
                        size='sm'
                        label='Stop screen sharing'
                        onClick={() => chatViewStopScreenShareRef.current?.()}
                      >
                        <span className='w-1.5 h-1.5 rounded-full bg-current animate-pulse' />
                        <Icon name='screenShare' size={16} />
                      </IconButton>
                    )}
                    <div className='relative' ref={moreMenuRef}>
                      <IconButton
                        variant='ghost'
                        size='sm'
                        label='More options'
                        onClick={() => setMoreMenuOpen(prev => !prev)}
                        aria-haspopup='true'
                        aria-expanded={moreMenuOpen}
                      >
                        <Icon name='moreVertical' size={16} />
                      </IconButton>
                      {moreMenuOpen && (
                        <Surface
                          className='absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg border border-border bg-card min-w-[140px] z-50'
                          role='menu'
                          onMouseDown={e => e.nativeEvent.stopImmediatePropagation()}
                        >
                          {onClearChat && (
                            <button
                              type='button'
                              className='w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary-bg rounded-md transition-colors'
                              onClick={() => {
                                const result = onClearChat();
                                if (result instanceof Promise) result.catch(e => console.error(e));
                                setMoreMenuOpen(false);
                              }}
                              role='menuitem'
                            >
                              <FiTrash2 className='w-3.5 h-3.5 opacity-60' />
                              Clear chat
                            </button>
                          )}
                          <button
                            type='button'
                            className='w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary-bg rounded-md transition-colors'
                            onClick={() => {
                              setDiagnosticOpen(true);
                              setMoreMenuOpen(false);
                            }}
                            role='menuitem'
                          >
                            <FiInfo className='w-3.5 h-3.5 opacity-60' />
                            About
                          </button>
                        </Surface>
                      )}
                    </div>
                  </>
                )}
                <IconButton variant='ghost' size='sm' label='Close' onClick={onClose}>
                  <Icon name='close' size={16} />
                </IconButton>
              </Flex>
            </Flex>

            <Surface className='flex-1 overflow-hidden flex flex-col min-h-0'>
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
                    onScreenSharingChange={handleHeaderScreenSharingChange}
                    onStartScreenShareRef={chatViewStartScreenShareRef}
                    onStopScreenShareRef={chatViewStopScreenShareRef}
                    messageInputRef={messageInputRef}
                  />
                )}
                {activeView === 'help' && (
                  <Flex
                    id='view-help'
                    role='tabpanel'
                    aria-labelledby='tab-help'
                    className='items-center justify-center h-full p-3'
                  >
                    <Text size='sm' variant='muted'>
                      Help – coming soon
                    </Text>
                  </Flex>
                )}
                {activeView === 'news' && (
                  <Flex
                    id='view-news'
                    role='tabpanel'
                    aria-labelledby='tab-news'
                    className='items-center justify-center h-full p-3'
                  >
                    <Text size='sm' variant='muted'>
                      News – coming soon
                    </Text>
                  </Flex>
                )}
              </ViewTransition>
            </Surface>

            <TabBar activeView={activeView} onViewChange={handleViewChange} tabs={tabs} />
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
              <Flex
                key={corner}
                role='separator'
                aria-label={`Resize widget from ${corner.replace('-', ' ')}`}
                title='Drag to resize'
                className={`absolute w-5 h-5 p-1 touch-none z-10 group ${posClasses[corner]}`}
                onMouseDown={onResizeStart(corner)}
              />
            );
          })}
      </Stack>
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
    </Surface>
  );
};

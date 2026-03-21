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
import { IconButton } from '../base/IconButton';
import { DiagnosticModal } from '../ui/DiagnosticModal';
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
    <div
      className={`${positionClass} rounded-[var(--radius)] pointer-events-auto bg-background`}
      style={{
        zIndex,
        backgroundImage,
        ...(isPreviewMode ? previewPositionStyle : panelPositionStyle),
      }}
    >
      <div
        ref={containerRef}
        className='rounded-[var(--radius)] shadow-[var(--shadow)] border border-border text-foreground flex flex-col relative overflow-hidden animate-messenger-entrance'
        style={{
          transformOrigin,
          ...customStyles,
          scrollbarWidth: 'thin',
        }}
      >
        {isMinimized ? (
          <div className='flex items-center justify-between px-3 h-10 border-b border-border'>
            <span className='text-sm font-medium text-foreground'>Marketrix</span>
            <IconButton variant='ghost' size='sm' label='Close' onClick={onClose}>
              <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                <path
                  fillRule='evenodd'
                  d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                  clipRule='evenodd'
                />
              </svg>
            </IconButton>
          </div>
        ) : (
          <>
            {/* Shared header: agent name + description */}
            <div className='flex justify-between items-center px-3 py-2 border-b border-border flex-shrink-0'>
              <div className='flex items-center gap-2 min-w-0 flex-1'>
                <img
                  src={MarketrixIcon}
                  alt=''
                  className='flex-shrink-0 w-8 h-8 rounded-[var(--radius)] object-cover shadow-[var(--shadow)]'
                />
                <div className='min-w-0'>
                  <div className='text-sm font-semibold leading-tight truncate text-foreground'>
                    {config.agent_name ?? 'AI Agent'}
                  </div>
                  <p className='text-xs text-foreground-muted truncate'>
                    {config.agent_description ?? 'How can I help?'}
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-0.5 flex-shrink-0'>
                {activeView === 'chat' && (
                  <>
                    {config.use_screenshare !== false && !headerScreenSharing && (
                      <IconButton
                        variant='ghost'
                        size='sm'
                        label='Start screen sharing'
                        onClick={() => chatViewStartScreenShareRef.current?.()}
                      >
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                          />
                        </svg>
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
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                          />
                        </svg>
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
                        <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                          <path d='M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z' />
                        </svg>
                      </IconButton>
                      {moreMenuOpen && (
                        <div
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
                        </div>
                      )}
                    </div>
                  </>
                )}
                <IconButton variant='ghost' size='sm' label='Close' onClick={onClose}>
                  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                    <path
                      fillRule='evenodd'
                      d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                      clipRule='evenodd'
                    />
                  </svg>
                </IconButton>
              </div>
            </div>

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
                    onScreenSharingChange={handleHeaderScreenSharingChange}
                    onStartScreenShareRef={chatViewStartScreenShareRef}
                    onStopScreenShareRef={chatViewStopScreenShareRef}
                    messageInputRef={messageInputRef}
                  />
                )}
                {activeView === 'help' && (
                  <div
                    id='view-help'
                    role='tabpanel'
                    aria-labelledby='tab-help'
                    className='flex items-center justify-center h-full p-3 text-sm text-foreground-muted'
                  >
                    Help – coming soon
                  </div>
                )}
                {activeView === 'news' && (
                  <div
                    id='view-news'
                    role='tabpanel'
                    aria-labelledby='tab-news'
                    className='flex items-center justify-center h-full p-3 text-sm text-foreground-muted'
                  >
                    News – coming soon
                  </div>
                )}
              </ViewTransition>
            </div>

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
    </div>
  );
};

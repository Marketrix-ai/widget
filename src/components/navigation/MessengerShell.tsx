import React, { useEffect, useRef, useState } from 'react';

import { SHADOW } from '../../design-system/shadows';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useResize } from '../../hooks/useResize';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import { createUserMessage } from '../../services/ChatService';
import { tenantScope } from '../../services/WidgetService';
import type { WidgetView } from '../../types';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { getCorner, getPanelPositionStyle } from '../../utils/widgetPositioning';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { HeaderBar } from '../blocks/HeaderBar';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
import { ResizeHandles } from './ResizeHandles';
import { ShellTabBar } from './ShellTabBar';

export const MessengerShell: React.FC = () => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { isOpen, activeView } = state;
  const isPreviewMode = config.isPreviewMode ?? false;

  const { widthPx, heightPx, onResizeStart, containerRef } = useResize(
    config.widget_width,
    config.widget_height,
    tenantScope(config),
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
    onEscape: actions.closeWidget,
    focusTargetRef: activeView === 'chat' ? messageInputRef : undefined,
  });

  const panelPositionStyle = getPanelPositionStyle(config.widget_position);

  // Must stay above the early return below.
  const [headerScreenSharing, setHeaderScreenSharing] = useState(false);
  const chatViewStartScreenShareRef = useRef<(() => void) | null>(null);
  const chatViewStopScreenShareRef = useRef<(() => void) | null>(null);

  if (!isOpen) return null;

  const backgroundImage = config.widget_background_color.includes('gradient')
    ? config.widget_background_color
    : `linear-gradient(135deg, ${config.widget_background_color} 0%, ${config.widget_background_color} 100%)`;

  const { vertical, horizontal } = getCorner(config.widget_position);

  const handleNavigateToChat = () => {
    setNavDirection('forward');
    actions.setActiveView('chat');
  };

  const handleChipClick = (action: SuggestedActionItem) => {
    actions.addMessage(createUserMessage(action.text, action.type, 'chip-message'));
    actions.setMode(action.type);
    void actions.messageDispatch(action.text, action.type, true);
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
      position={isPreviewMode ? 'absolute' : 'fixed'}
      rounded='theme'
      border
      overflow='hidden'
      style={{
        zIndex: config.widget_position_z_index,
        backgroundImage,
        transformOrigin: `${vertical} ${horizontal}`,
        width: widthPx,
        height: heightPx,
        fontSize: config.widget_font_size,
        ...panelPositionStyle,
        pointerEvents: 'auto',
        scrollbarWidth: 'thin',
        animation: 'messenger-entrance 300ms cubic-bezier(0, 1.2, 1, 1)',
        boxShadow: SHADOW.panel,
      }}
    >
      <HeaderBar
        title={config.widget_header ?? 'AI Agent'}
        subtitle={config.widget_body ?? 'How can I help?'}
        onClose={actions.closeWidget}
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

      <Surface grow overflow='hidden' style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Surface
          key={activeView}
          data-view-transition
          data-direction={navDirection}
          style={{ width: '100%', height: '100%' }}
        >
          {activeView === 'home' && <HomeView onNavigateToChat={handleNavigateToChat} onChipClick={handleChipClick} />}
          {activeView === 'chat' && (
            <ChatView
              onScreenSharingChange={setHeaderScreenSharing}
              onStartScreenShareRef={chatViewStartScreenShareRef}
              onStopScreenShareRef={chatViewStopScreenShareRef}
              messageInputRef={messageInputRef}
            />
          )}
        </Surface>
      </Surface>

      <ShellTabBar activeView={activeView} onChange={actions.setActiveView} />

      {!isPreviewMode && <ResizeHandles onResizeStart={onResizeStart} />}
    </Stack>
  );
};

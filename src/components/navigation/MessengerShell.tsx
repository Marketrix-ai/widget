import { Tabs } from '@base-ui/react/tabs';
import React, { useRef, useState } from 'react';

import { SHADOW } from '../../design-system/shadows';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useResize } from '../../hooks/useResize';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import { tenantScope } from '../../services/StorageService';
import type { WidgetView } from '../../types';
import { createUserMessage } from '../../utils/chat';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { getCorner, getPanelPositionStyle } from '../../utils/widgetPositioning';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { HeaderBar } from '../blocks/HeaderBar';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
import { ResizeHandle } from './ResizeHandle';
import { ShellTabBar } from './ShellTabBar';

export const MessengerShell: React.FC = () => {
  const config = useWidgetConfig();
  const { state, actions } = useWidget();
  const { isOpen, activeView } = state;
  const isPreviewMode = config.isPreviewMode ?? false;

  const { widthPx, heightPx, grip, onResizeStart, containerRef } = useResize(
    config.widget_width,
    config.widget_height,
    config.widget_position,
    tenantScope(config),
    isPreviewMode,
  );

  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const navDirection = activeView === 'chat' ? 'forward' : 'back';

  useFocusTrap(containerRef, isOpen, {
    onEscape: actions.closeWidget,
    focusTargetRef: activeView === 'chat' ? messageInputRef : undefined,
  });

  const panelPositionStyle = getPanelPositionStyle(config.widget_position);

  // Must stay above the early return below.
  const [headerScreenSharing, setHeaderScreenSharing] = useState(false);
  const chatViewToggleScreenShareRef = useRef<(() => void) | null>(null);

  if (!isOpen) return null;

  const backgroundImage = config.widget_background_color.includes('gradient')
    ? config.widget_background_color
    : `linear-gradient(135deg, ${config.widget_background_color} 0%, ${config.widget_background_color} 100%)`;

  const { vertical, horizontal } = getCorner(config.widget_position);

  const handleNavigateToChat = () => {
    actions.setActiveView('chat');
  };

  const handleChipClick = (action: SuggestedActionItem) => {
    actions.addMessage(createUserMessage(action.text, action.type, 'chip-message'));
    actions.setMode(action.type);
    void actions.messageDispatch(action.text, action.type, true);
  };

  const screenShareHandler =
    activeView === 'chat' && config.use_screenshare !== false
      ? () => chatViewToggleScreenShareRef.current?.()
      : undefined;

  return (
    <Stack
      ref={containerRef}
      position={isPreviewMode ? 'absolute' : 'fixed'}
      rounded='lg'
      border
      overflow='hidden'
      style={{
        zIndex: config.widget_position_z_index,
        backgroundImage,
        transformOrigin: `${vertical} ${horizontal}`,
        width: widthPx,
        height: heightPx,
        fontSize: '14px',
        ...panelPositionStyle,
        pointerEvents: 'auto',
        scrollbarWidth: 'thin',
        animation: 'messenger-entrance 300ms cubic-bezier(0, 1.2, 1, 1)',
        boxShadow: SHADOW.panel,
      }}
    >
      <HeaderBar
        title={config.widget_header}
        subtitle={config.widget_body}
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
                <span className='mtx-screenshare-dot'>
                  <span className='mtx-screenshare-dot-ping' />
                  <span className='mtx-screenshare-dot-core' />
                </span>
              )}
              <Icon name='screenShare' size={16} />
            </IconButton>
          )
        }
      />

      <Tabs.Root
        value={activeView}
        onValueChange={value => actions.setActiveView(value as WidgetView)}
        style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0 }}
      >
        <Surface grow overflow='hidden' style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Panels unmount when deselected, so the active one remounts and replays the slide. */}
          <Tabs.Panel
            value='home'
            data-view-transition
            data-direction={navDirection}
            style={{ width: '100%', height: '100%' }}
          >
            <HomeView onNavigateToChat={handleNavigateToChat} onChipClick={handleChipClick} />
          </Tabs.Panel>
          <Tabs.Panel
            value='chat'
            data-view-transition
            data-direction={navDirection}
            style={{ width: '100%', height: '100%' }}
          >
            <ChatView
              onScreenSharingChange={setHeaderScreenSharing}
              toggleScreenShareRef={chatViewToggleScreenShareRef}
              messageInputRef={messageInputRef}
            />
          </Tabs.Panel>
        </Surface>

        <ShellTabBar />
      </Tabs.Root>

      {!isPreviewMode && <ResizeHandle grip={grip} onMouseDown={onResizeStart} />}
    </Stack>
  );
};

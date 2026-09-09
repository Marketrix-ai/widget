/**
 * The open widget panel: the corner-pinned, resizable surface carrying the header bar, the Home/Chat tab views and
 * the resize grip. `MessengerShell` renders null while the store says closed; `WidgetRoot` is its only caller.
 *
 * Geometry comes from the tenant config, never from props. `useResize` owns the persisted size, keyed by
 * `tenantScope(config)` so two tenants on one host page cannot share a stored size; `getPanelPositionStyle` pins
 * the panel to the configured corner and `getCorner` supplies the matching `transformOrigin`, so the entrance
 * animation scales out of the anchored corner instead of the panel's centre. Preview mode (the dashboard embed)
 * positions `absolute` rather than `fixed` and drops the 20px corner resize grip — a labelled `separator` with
 * `touchAction: none`, so a drag is not hijacked by scrolling — since it lives inside a page element. `useFocusTrap` closes on Escape and, on the chat view, lands focus in the composer
 * through `messageInputRef` — the same ref `ChatView` attaches to its textarea.
 *
 * The screen-share control sits in the header, but its machinery lives in `ChatView`'s `useScreenShare`:
 * `chatViewToggleScreenShareRef` is what that hook's `useImperativeHandle` fills, and `onScreenSharingChange`
 * mirrors sharing state back up for the button's label and live dot. That ref and `headerScreenSharing` are
 * declared ABOVE the closed-panel early return, since a hook below a conditional return changes hook order between
 * renders. `handleChipClick` treats a home-screen suggestion as a typed message, dispatching it under the chip's
 * mode; `navDirection` is what `index.css` reads off `data-direction` to slide the incoming view, since Base UI
 * unmounts a deselected `Tabs.Panel` and the selected one remounts and replays that slide on each switch.
 */
import { Tabs } from '@base-ui/react/tabs';
import React, { useRef, useState } from 'react';

import { SHADOW } from '../../design-system/component-tokens';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useResize } from '../../hooks/useResize';
import { useWidget, useWidgetConfig } from '../../hooks/useWidget';
import { tenantScope } from '../../services/StorageService';
import type { WidgetView } from '../../types';
import { createUserMessage } from '../../utils/chat';
import { backgroundGradient } from '../../utils/color';
import type { SuggestedActionItem } from '../../utils/suggestedActions';
import { getCorner, getPanelPositionStyle } from '../../utils/widgetPositioning';
import { Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Surface } from '../base/Surface';
import { HeaderBar } from '../blocks/HeaderBar';
import { ChatView } from '../views/ChatView';
import { HomeView } from '../views/HomeView';
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

  const [headerScreenSharing, setHeaderScreenSharing] = useState(false);
  const chatViewToggleScreenShareRef = useRef<(() => void) | null>(null);

  if (!isOpen) return null;

  const backgroundImage = backgroundGradient(config.widget_background_color);

  const { vertical, horizontal } = getCorner(config.widget_position);

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
          <Tabs.Panel
            value='home'
            data-view-transition
            data-direction={navDirection}
            style={{ width: '100%', height: '100%' }}
          >
            <HomeView onNavigateToChat={() => actions.setActiveView('chat')} onChipClick={handleChipClick} />
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

      {!isPreviewMode && (
        <div
          role='separator'
          aria-label={`Resize widget from ${grip.vertical} ${grip.horizontal}`}
          title='Drag to resize'
          style={{
            position: 'absolute',
            [grip.vertical]: 0,
            [grip.horizontal]: 0,
            width: '20px',
            height: '20px',
            padding: '4px',
            touchAction: 'none',
            zIndex: 10,
            display: 'flex',
            alignItems: grip.vertical === 'top' ? 'flex-start' : 'flex-end',
            justifyContent: grip.horizontal === 'left' ? 'flex-start' : 'flex-end',
            cursor: grip.cursor,
          }}
          onMouseDown={onResizeStart}
        />
      )}
    </Stack>
  );
};

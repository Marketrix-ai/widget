/**
 * The widget's one notification surface on Base UI Toast, which owns the live region, timers and stacking.
 * `NotificationList` renders toasts in the error or info tone, `NotificationProvider` portals the viewport
 * into the widget's shadow root on the launcher's bottom baseline (on narrow screens it spans the row beside a bottom
 * launcher instead of centring over it), and `WidgetNotifications` mirrors the `error` and
 * host-page `notice` props into toasts under a stable id, so a re-render upserts rather than duplicating.
 */
import { Toast } from '@base-ui/react/toast';
import React, { useEffect } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { LAYER_TOKENS, notificationToneStyles } from '../../design-system/component-tokens';
import { EDGE_OFFSET_PX, LAUNCHER_SIZE_PX } from '../../utils/widgetPositioning';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex, Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Text } from '../base/Text';

const NOTICE_TIMEOUT_MS = 8000;

const NotificationList: React.FC = () => {
  const { toasts } = Toast.useToastManager();

  return toasts.map(toast => {
    const colors = notificationToneStyles[toast.type === 'error' ? 'error' : 'info'];

    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className='mtx-toast'
        render={
          <Flex
            align='center'
            gap='md'
            rounded='pill'
            elevation='panel'
            style={{ backgroundColor: colors.background, border: colors.border, padding: '8px 12px 8px 8px' }}
          />
        }
      >
        <Avatar src={MarketrixIcon} alt='' size={28} rounded='pill' />

        <Stack grow minWidth='0'>
          <Toast.Title
            render={
              <Text
                as='span'
                block
                tone='inherit'
                truncate
                weight='medium'
                style={{
                  fontSize: '13px',
                  color: colors.titleColor,
                  ...(toast.actionProps && { whiteSpace: 'normal' }),
                }}
              />
            }
          />
        </Stack>

        {toast.actionProps && (
          <Toast.Action
            render={
              <Button
                variant='ghost'
                shape='pill'
                size='sm'
                style={{
                  color: colors.titleColor,
                  backgroundColor: colors.actionBackground,
                  border: colors.border,
                }}
              />
            }
          />
        )}

        <Toast.Close
          onMouseDown={event => event.preventDefault()}
          render={
            <IconButton label='Dismiss' size='xs' tone='inherit' style={{ color: colors.closeColor, padding: '2px' }} />
          }
        >
          <Icon name='closeSmall' size={12} />
        </Toast.Close>
      </Toast.Root>
    );
  });
};

interface NotificationProviderProps {
  children?: React.ReactNode;
  container?: HTMLElement | null;
  launcherSide?: 'left' | 'right' | undefined;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children, container, launcherSide }) => (
  <Toast.Provider>
    {children}
    <Toast.Portal container={container ?? undefined}>
      <Toast.Viewport
        className='mtx-toast-viewport'
        style={{
          zIndex: LAYER_TOKENS.toast,
          ...{
            '--mtx-toast-edge': `${EDGE_OFFSET_PX}px`,
            '--mtx-toast-left': `${EDGE_OFFSET_PX + (launcherSide === 'left' ? LAUNCHER_SIZE_PX + 8 : 0)}px`,
            '--mtx-toast-right': `${EDGE_OFFSET_PX + (launcherSide === 'right' ? LAUNCHER_SIZE_PX + 8 : 0)}px`,
          },
        }}
      >
        <NotificationList />
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
);

interface WidgetNotificationsProps {
  error?: string | undefined;
  onClearError: () => void;
  onRetry?: (() => void) | undefined;
  notice?: string | undefined;
  onNoticeDismiss?: () => void;
}

export const WidgetNotifications: React.FC<WidgetNotificationsProps> = ({
  error,
  onClearError,
  onRetry,
  notice,
  onNoticeDismiss,
}) => {
  const { add, close } = Toast.useToastManager();

  useEffect(() => {
    if (error == null) {
      close('error');
      return;
    }
    add({
      id: 'error',
      type: 'error',
      title: error,
      timeout: 0,
      priority: 'high',
      onClose: onClearError,
      ...(onRetry && { actionProps: { children: 'Retry', onClick: onRetry } }),
    });
  }, [error, onRetry, add, close, onClearError]);

  useEffect(() => {
    if (!notice) {
      close('notice');
      return;
    }
    add({
      id: 'notice',
      type: 'info',
      title: notice,
      timeout: NOTICE_TIMEOUT_MS,
      ...(onNoticeDismiss && { onClose: onNoticeDismiss }),
    });
  }, [notice, add, close, onNoticeDismiss]);

  return null;
};

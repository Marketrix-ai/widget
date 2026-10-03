/**
 * The widget's one notification surface on Base UI Toast, which owns the live region, timers and stacking.
 * `NotificationList` renders toasts in the error or info tone, `NotificationProvider` portals the viewport
 * into the widget's shadow root on the launcher's bottom baseline (lifted above a bottom launcher only on narrow
 * screens, where the centred toast would cover it), and `WidgetNotifications` mirrors the `error` and
 * `greeting` props into toasts under a stable id, so a re-render upserts rather than duplicating.
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

const GREETING_TIMEOUT_MS = 8000;

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
          {toast.description != null && (
            <Toast.Description
              render={
                <Text
                  as='span'
                  block
                  tone='inherit'
                  truncate
                  style={{ fontSize: '12px', color: colors.bodyColor, opacity: 0.8 }}
                />
              }
            />
          )}
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
  launcherBelow?: boolean;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  container,
  launcherBelow = false,
}) => (
  <Toast.Provider>
    {children}
    <Toast.Portal container={container ?? undefined}>
      <Toast.Viewport
        className='mtx-toast-viewport'
        style={{
          zIndex: LAYER_TOKENS.toast,
          ...{
            '--mtx-toast-edge': `${EDGE_OFFSET_PX}px`,
            '--mtx-toast-lift': `${launcherBelow ? EDGE_OFFSET_PX + LAUNCHER_SIZE_PX : 0}px`,
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
  greeting?: string | undefined;
  greetingBody?: string;
  onGreetingDismiss: () => void;
}

export const WidgetNotifications: React.FC<WidgetNotificationsProps> = ({
  error,
  onClearError,
  onRetry,
  greeting,
  greetingBody,
  onGreetingDismiss,
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
    if (!greeting) {
      close('greeting');
      return;
    }
    add({
      id: 'greeting',
      type: 'info',
      title: greeting,
      description: greetingBody,
      timeout: GREETING_TIMEOUT_MS,
      onClose: onGreetingDismiss,
    });
  }, [greeting, greetingBody, add, close, onGreetingDismiss]);

  return null;
};

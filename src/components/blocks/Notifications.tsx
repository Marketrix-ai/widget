import { Toast } from '@base-ui/react/toast';
import React, { useEffect } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { type NotificationTone, notificationToneStyles } from '../../design-system/component-tokens';
import { LAYER_TOKENS } from '../../design-system/layers';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

export const GREETING_TIMEOUT_MS = 8000;

const toneOf = (type: string | undefined): NotificationTone => (type === 'error' || type === 'info' ? type : 'neutral');

const NotificationList: React.FC = () => {
  const { toasts } = Toast.useToastManager();

  return toasts.map(toast => {
    const colors = notificationToneStyles[toneOf(toast.type)];

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
            paddingPreset='toast'
            elevation='panel'
            style={{ backgroundColor: colors.background, border: colors.border }}
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
                inheritColor
                weight='medium'
                style={{
                  fontSize: '13px',
                  color: colors.titleColor,
                  whiteSpace: toast.actionProps ? 'normal' : 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
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
                  inheritColor
                  style={{
                    fontSize: '12px',
                    color: colors.bodyColor,
                    opacity: 0.8,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                />
              }
            />
          )}
        </Stack>

        {toast.actionProps && (
          <Toast.Action
            render={
              <Button
                type='button'
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

export interface NotificationProviderProps {
  children?: React.ReactNode;
  container?: HTMLElement | null;
  offsetBottom?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  container,
  offsetBottom = 20,
}) => (
  <Toast.Provider>
    {children}
    <Toast.Portal container={container ?? undefined}>
      <Toast.Viewport
        className='mtx-toast-viewport'
        style={{ zIndex: LAYER_TOKENS.toast, bottom: `${offsetBottom}px` }}
      >
        <NotificationList />
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
);

export const useNotifications = Toast.useToastManager;

export interface WidgetNotificationsProps {
  error?: string;
  onClearError: () => void;
  onRetry?: () => void;
  greeting?: string;
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
  const { add, close } = useNotifications();

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

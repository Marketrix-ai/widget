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

/** `type` on a Base UI toast is a free string; these are the three the tone styling understands. */
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
        <Avatar src={MarketrixIcon} alt='' size={28} rounded='full' />

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
  /** The closed shadow root to portal into — a portal to document.body would leave the styles behind. */
  container?: HTMLElement | null;
  /** Raised above the launcher when the launcher sits at the bottom, so the two cannot overlap. */
  offsetBottom?: number;
}

/**
 * The one notification surface. Base UI owns the live region, the dismiss timers, hover-to-pause and
 * stacking; before this the widget announced nothing to a screen reader and ran its own setTimeout.
 */
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

/**
 * Drives the toasts from widget state. Both use a stable id, so `add` upserts and a re-render cannot
 * stack duplicates of the same condition.
 */
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
    if (error == null) return;
    add({
      id: 'error',
      type: 'error',
      title: error,
      // An error stays until it is acted on; only the greeting is transient.
      timeout: 0,
      priority: 'high',
      onClose: onClearError,
      ...(onRetry && { actionProps: { children: 'Retry', onClick: onRetry } }),
    });
    return () => close('error');
  }, [error, onRetry, add, close, onClearError]);

  useEffect(() => {
    if (!greeting) return;
    add({
      id: 'greeting',
      type: 'info',
      title: greeting,
      description: greetingBody,
      timeout: GREETING_TIMEOUT_MS,
      onClose: onGreetingDismiss,
    });
    return () => close('greeting');
  }, [greeting, greetingBody, add, close, onGreetingDismiss]);

  return null;
};

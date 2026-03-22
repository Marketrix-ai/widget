import React, { useCallback, useEffect, useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { notificationToneStyles } from '../../design-system/component-tokens';
import { LAYER_TOKENS } from '../../design-system/layers';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

const AUTO_DISMISS_MS = 8000;

function getPositionStyle(position: 'bottom-center' | 'above-fab'): React.CSSProperties {
  if (position === 'above-fab') {
    return { bottom: '90px', left: '50%', transform: 'translateX(-50%)' };
  }
  return { bottom: '20px', left: '50%', transform: 'translateX(-50%)' };
}

export interface NotificationToastProps {
  tone: 'info' | 'error';
  title: string;
  body?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  position?: 'bottom-center' | 'above-fab';
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  tone,
  title,
  body,
  onDismiss,
  onRetry,
  position = 'bottom-center',
}) => {
  const [isExiting, setIsExiting] = useState(false);

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  // Auto-dismiss after 8s for info tone
  useEffect(() => {
    if (tone !== 'info') return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [tone, dismiss]);

  const colors = notificationToneStyles[tone];

  return (
    <Surface
      position='fixed'
      style={{
        zIndex: LAYER_TOKENS.toast,
        maxWidth: '420px',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        animation: isExiting ? 'none' : 'fadeIn 0.3s ease-out',
        ...getPositionStyle(position),
      }}
    >
      <Flex
        align='center'
        gap='md'
        rounded='pill'
        paddingPreset='toast'
        elevation='panel'
        style={{
          backgroundColor: colors.background,
          border: colors.border,
        }}
      >
        <Avatar src={MarketrixIcon} alt='' size={28} rounded='full' />

        <Stack grow minWidth='0'>
          <Text
            as='span'
            block
            inheritColor
            weight='medium'
            style={{
              fontSize: '13px',
              color: colors.titleColor,
              whiteSpace: onRetry ? 'normal' : 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </Text>
          {body && (
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
            >
              {body}
            </Text>
          )}
        </Stack>

        {onRetry && (
          <Button
            type='button'
            variant='ghost'
            shape='pill'
            size='sm'
            onClick={() => {
              onRetry();
              dismiss();
            }}
            style={{
              color: colors.titleColor,
              backgroundColor: colors.actionBackground,
              border: colors.border,
            }}
            aria-label='Retry'
          >
            Retry
          </Button>
        )}

        <IconButton
          label='Dismiss'
          onClick={e => {
            e.stopPropagation();
            dismiss();
          }}
          shape='circle'
          size='xs'
          tone='inherit'
          style={{
            color: colors.closeColor,
            padding: '2px',
          }}
        >
          <Icon name='closeSmall' size={12} />
        </IconButton>
      </Flex>
    </Surface>
  );
};

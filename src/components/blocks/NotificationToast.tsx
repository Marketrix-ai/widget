import React, { useCallback, useEffect, useState } from 'react';

import { LAYER_TOKENS } from '../../design-system/layers';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

// Hardcoded hex colors — these toasts render outside the themed panel
const TONE_STYLES = {
  info: {
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    titleColor: '#0c4a6e',
    bodyColor: '#0369a1',
    closeColor: '#7dd3fc',
    closeHoverColor: '#38bdf8',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    titleColor: '#b91c1c',
    bodyColor: '#b91c1c',
    closeColor: '#f87171',
    closeHoverColor: '#ef4444',
  },
} as const;

export interface NotificationToastProps {
  tone: 'info' | 'error';
  /** Logo image URL */
  icon?: string;
  title: string;
  body?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  position?: 'bottom-center' | 'above-fab';
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  tone,
  icon,
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
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [tone, dismiss]);

  const positionStyle: React.CSSProperties =
    position === 'bottom-center'
      ? { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }
      : { bottom: '90px', left: '50%', transform: 'translateX(-50%)' };

  const colors = TONE_STYLES[tone];

  return (
    <Surface
      className='fixed'
      style={{
        zIndex: LAYER_TOKENS.toast,
        maxWidth: '420px',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        animation: isExiting ? 'none' : 'fadeIn 0.3s ease-out',
        ...positionStyle,
      }}
    >
      <Flex
        className='items-center gap-2.5 rounded-full shadow-lg'
        style={{
          padding: '8px 12px 8px 8px',
          backgroundColor: colors.background,
          border: colors.border,
        }}
      >
        {icon && <Avatar src={icon} alt='' size={28} className='flex-shrink-0' style={{ borderRadius: '50%' }} />}

        <Stack className='flex-1 min-w-0'>
          <Text
            as='span'
            weight='medium'
            className='block text-inherit'
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
              className='block text-inherit'
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
            onClick={() => {
              onRetry();
              dismiss();
            }}
            className='flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors'
            style={{
              color: colors.titleColor,
              backgroundColor: tone === 'error' ? '#fee2e2' : '#e0f2fe',
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
          className='flex-shrink-0'
          style={{ width: '20px', height: '20px', padding: '2px', color: colors.closeColor }}
        >
          <Icon name='closeSmall' size={12} />
        </IconButton>
      </Flex>
    </Surface>
  );
};

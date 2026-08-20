import React, { useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { Avatar } from '../base/Avatar';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

const LOADER_TOAST_COLORS = {
  gray500: '#6b7280',
  gray800: '#1f2937',
  white95: 'rgba(255, 255, 255, 0.95)',
  white20: 'rgba(255, 255, 255, 0.2)',
  black15: 'rgba(0, 0, 0, 0.15)',
} as const;

interface WidgetSettingsLoaderProps {
  message?: string;
}

export const WidgetSettingsLoader: React.FC<WidgetSettingsLoaderProps> = ({
  message = 'Loading widget settings...',
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Surface
      position='fixed'
      style={{
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '420px',
        backgroundColor: LOADER_TOAST_COLORS.white95,
        borderRadius: '999px',
        boxShadow: `0 2px 12px ${LOADER_TOAST_COLORS.black15}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '8px',
        padding: '10px 12px',
        border: `1px solid ${LOADER_TOAST_COLORS.white20}`,
        zIndex: 9999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <Flex align='center' style={{ gap: '10px' }}>
        <Avatar
          src={MarketrixIcon}
          alt=''
          size={28}
          style={{ borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}
        />

        <Text
          as='span'
          style={{
            fontSize: '13px',
            color: LOADER_TOAST_COLORS.gray800,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}
        >
          {message}
        </Text>

        <IconButton
          label='Dismiss'
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: LOADER_TOAST_COLORS.gray500,
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            minWidth: 'unset',
          }}
        >
          <Icon name='closeSmall' size={12} />
        </IconButton>
      </Flex>
    </Surface>
  );
};

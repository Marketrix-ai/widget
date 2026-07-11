import React, { useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { Avatar } from '../base/Avatar';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

const DARK_THEME_COLORS = {
  white: '#ffffff',
  black: '#000000',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  white70: 'rgba(255, 255, 255, 0.7)',
  white95: 'rgba(255, 255, 255, 0.95)',
  white20: 'rgba(255, 255, 255, 0.2)',
  black10: 'rgba(0, 0, 0, 0.1)',
  black06: 'rgba(0, 0, 0, 0.06)',
  black15: 'rgba(0, 0, 0, 0.15)',
  liveBadgeShadow: 'rgba(31, 41, 55, 0.4)',
  videoGradient: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
} as const;

interface WidgetSettingsLoaderProps {
  message?: string;
}

export const WidgetSettingsLoader: React.FC<WidgetSettingsLoaderProps> = ({
  message = 'Loading widget settings...',
}) => {
  const [dismissed, setDismissed] = useState(false);
  const showCredentialHint = message?.includes('marketrix_id') || message?.includes('marketrix_key');

  if (dismissed) return null;

  return (
    <Surface
      position='fixed'
      style={{
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '420px',
        backgroundColor: DARK_THEME_COLORS.white95,
        borderRadius: showCredentialHint ? '18px' : '999px',
        boxShadow: `0 2px 12px ${DARK_THEME_COLORS.black15}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '8px',
        padding: '10px 12px',
        border: `1px solid ${DARK_THEME_COLORS.white20}`,
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
            color: DARK_THEME_COLORS.gray800,
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
            color: DARK_THEME_COLORS.gray500,
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            minWidth: 'unset',
          }}
        >
          <Icon name='closeSmall' size={12} />
        </IconButton>
      </Flex>

      {showCredentialHint ? (
        <Text
          as='p'
          style={{
            fontSize: '12px',
            color: DARK_THEME_COLORS.gray500,
            textAlign: 'left',
            margin: 0,
          }}
        >
          Please configure marketrix_id and marketrix_key
        </Text>
      ) : null}
    </Surface>
  );
};

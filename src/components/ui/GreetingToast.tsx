import React, { useCallback, useEffect, useState } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { Avatar } from '../base/Avatar';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

interface GreetingToastProps {
  greeting: string;
  body?: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export const GreetingToast: React.FC<GreetingToastProps> = ({ greeting, body, onClose, autoCloseMs = 8000 }) => {
  const [isExiting, setIsExiting] = useState(false);

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(dismiss, autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, dismiss]);

  return (
    <Surface
      className='fixed'
      style={{
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '420px',
        zIndex: 2147483030,
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        animation: isExiting ? 'none' : 'fadeIn 0.3s ease-out',
      }}
    >
      <Flex
        className='items-center gap-2.5 rounded-full shadow-lg cursor-pointer'
        style={{
          padding: '8px 12px 8px 8px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
        }}
        onClick={dismiss}
      >
        <Avatar src={MarketrixIcon} alt='' size={28} className='flex-shrink-0' style={{ borderRadius: '50%' }} />

        <Stack className='flex-1 min-w-0'>
          <Text
            as='span'
            weight='medium'
            className='block text-inherit'
            style={{
              fontSize: '13px',
              color: '#0c4a6e',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {greeting}
          </Text>
          {body && (
            <Text
              as='span'
              className='block text-inherit'
              style={{
                fontSize: '12px',
                color: '#0369a1',
                opacity: 0.7,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {body}
            </Text>
          )}
        </Stack>

        <IconButton
          label='Dismiss'
          onClick={e => {
            e.stopPropagation();
            dismiss();
          }}
          className='flex-shrink-0'
          style={{ width: '20px', height: '20px', padding: '2px', color: '#7dd3fc' }}
        >
          <Icon name='closeSmall' size={12} />
        </IconButton>
      </Flex>
    </Surface>
  );
};

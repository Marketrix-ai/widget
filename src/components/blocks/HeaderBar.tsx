import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { SHADOW } from '../../design-system/shadows';
import { Avatar, Flex, Icon, IconButton, Stack, Text } from '../base';

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  minimized?: boolean;
  onClose: () => void;
  /** Optional control buttons rendered before the close button */
  controls?: React.ReactNode;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ title, subtitle, minimized = false, onClose, controls }) => {
  if (minimized) {
    return (
      <Flex
        className='items-center justify-between px-3 h-10 border-b border-border flex-shrink-0'
        style={{ boxShadow: SHADOW.section }}
      >
        <Text size='sm' weight='medium'>
          {title}
        </Text>
        <IconButton variant='ghost' size='sm' label='Close' onClick={onClose}>
          <Icon name='close' size={16} />
        </IconButton>
      </Flex>
    );
  }

  return (
    <Flex
      className='justify-between items-center px-3 py-2 border-b border-border flex-shrink-0'
      style={{ boxShadow: SHADOW.section }}
    >
      <Flex className='items-center gap-2 min-w-0 flex-1'>
        <Avatar src={MarketrixIcon} alt='' size='md' className='rounded-[var(--radius)] shadow-[var(--shadow)]' />
        <Stack className='min-w-0'>
          <Text size='sm' weight='semibold' truncate className='leading-tight'>
            {title}
          </Text>
          {subtitle != null && (
            <Text as='p' size='xs' variant='muted' truncate>
              {subtitle}
            </Text>
          )}
        </Stack>
      </Flex>

      <Flex className='items-center gap-0.5 flex-shrink-0'>
        {controls}
        <IconButton variant='ghost' size='sm' label='Close' onClick={onClose}>
          <Icon name='close' size={16} />
        </IconButton>
      </Flex>
    </Flex>
  );
};

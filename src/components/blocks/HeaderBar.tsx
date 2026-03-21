import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import {
  Avatar,
  Badge,
  Flex,
  Icon,
  IconButton,
  type IconName,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Stack,
  Text,
} from '../base';

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  minimized?: boolean;
  screenSharing?: boolean;
  onScreenShare?: () => void;
  onClose: () => void;
  menuItems?: { label: string; icon?: IconName; onClick: () => void }[];
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  minimized = false,
  screenSharing = false,
  onScreenShare,
  onClose,
  menuItems,
}) => {
  if (minimized) {
    return (
      <Flex className='items-center justify-between px-3 h-10 border-b border-border flex-shrink-0'>
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
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
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
        {onScreenShare != null && (
          <IconButton
            variant='ghost'
            size='sm'
            label={screenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
            onClick={onScreenShare}
          >
            {screenSharing && <Badge variant='live' className='absolute top-0.5 right-0.5' />}
            <Icon name='screenShare' size={16} />
          </IconButton>
        )}

        {menuItems != null && menuItems.length > 0 && (
          <Menu>
            <MenuTrigger className='relative inline-flex items-center justify-center w-7 h-7 rounded-full text-foreground opacity-60 hover:opacity-100 hover:bg-muted transition-colors'>
              <Icon name='moreVertical' size={16} />
            </MenuTrigger>
            <MenuContent className='right-0 top-full mt-1 min-w-[140px]'>
              {menuItems.map(item => (
                <MenuItem key={item.label} onClick={item.onClick}>
                  {item.icon != null && <Icon name={item.icon} size={14} className='opacity-60' />}
                  {item.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}

        <IconButton variant='ghost' size='sm' label='Close' onClick={onClose}>
          <Icon name='close' size={16} />
        </IconButton>
      </Flex>
    </Flex>
  );
};

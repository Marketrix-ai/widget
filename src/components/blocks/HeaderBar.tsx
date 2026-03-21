import React, { useEffect, useRef, useState } from 'react';

import { Avatar, Badge, Flex, Icon, IconButton, type IconName, Stack, Surface, Text } from '../base';

export interface HeaderBarProps {
  logo?: string;
  title: string;
  subtitle?: string;
  minimized?: boolean;
  screenSharing?: boolean;
  onScreenShare?: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  menuItems?: { label: string; icon?: IconName; onClick: () => void }[];
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  logo,
  title,
  subtitle,
  minimized = false,
  screenSharing = false,
  onScreenShare,
  onClose,
  menuItems,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.composedPath()[0] as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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
    <Flex className='justify-between items-center px-3 py-2 border-b border-border flex-shrink-0'>
      <Flex className='items-center gap-2 min-w-0 flex-1'>
        {logo != null && (
          <Avatar src={logo} alt='' size='md' className='rounded-[var(--radius)] shadow-[var(--shadow)]' />
        )}
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
          <div className='relative' ref={menuRef}>
            <IconButton
              variant='ghost'
              size='sm'
              label='More options'
              onClick={() => setMenuOpen(prev => !prev)}
              aria-haspopup='true'
              aria-expanded={menuOpen}
            >
              <Icon name='moreVertical' size={16} />
            </IconButton>
            {menuOpen && (
              <Surface
                className='absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg border border-border bg-card min-w-[140px] z-50'
                role='menu'
                onMouseDown={e => e.nativeEvent.stopImmediatePropagation()}
              >
                {menuItems.map(item => (
                  <button
                    key={item.label}
                    type='button'
                    className='w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary-bg rounded-md transition-colors'
                    onClick={() => {
                      item.onClick();
                      setMenuOpen(false);
                    }}
                    role='menuitem'
                  >
                    {item.icon != null && <Icon name={item.icon} size={14} className='opacity-60' />}
                    {item.label}
                  </button>
                ))}
              </Surface>
            )}
          </div>
        )}

        <IconButton variant='ghost' size='sm' label='Close' onClick={onClose}>
          <Icon name='close' size={16} />
        </IconButton>
      </Flex>
    </Flex>
  );
};

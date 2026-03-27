import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { controlSizeStyles } from '../../design-system/component-tokens';
import { Avatar, Flex, Icon, IconButton, Stack, Surface, Text } from '../base';

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
        align='center'
        justify='between'
        paddingX='lg'
        border='bottom'
        shrink={false}
        style={controlSizeStyles.header}
      >
        <Text size='sm' weight='medium'>
          {title}
        </Text>
        <IconButton variant='toolbar' size='sm' label='Close' onClick={onClose}>
          <Icon name='close' size={16} />
        </IconButton>
      </Flex>
    );
  }

  return (
    <Flex
      align='center'
      justify='between'
      paddingX='lg'
      border='bottom'
      shrink={false}
      elevation='section'
      className='header-blur'
      style={{ position: 'relative', zIndex: 2, height: 56, backgroundColor: 'var(--card)' }}
    >
      <Flex align='center' gap='md' minWidth='0' grow>
        <Flex
          shrink={false}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
            padding: '2px',
            boxShadow: '0 2px 8px var(--primary-muted)',
          }}
        >
          <Avatar
            src={MarketrixIcon}
            alt=''
            size={32}
            rounded='lg'
            style={{ border: 'none', backgroundColor: 'transparent' }}
          />
        </Flex>
        <Stack minWidth='0' gap='2xs'>
          <Text size='sm' weight='semibold' truncate leading='tight'>
            {title}
          </Text>
          {subtitle != null && (
            <Flex align='center' gap='xs'>
              <Surface
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)',
                  flexShrink: 0,
                }}
              />
              <Text as='p' size='xs' variant='muted' truncate>
                {subtitle}
              </Text>
            </Flex>
          )}
        </Stack>
      </Flex>

      <Flex align='center' gap='xs' shrink={false}>
        {controls}
        <IconButton variant='toolbar' size='sm' label='Close' onClick={onClose}>
          <Icon name='close' size={16} />
        </IconButton>
      </Flex>
    </Flex>
  );
};

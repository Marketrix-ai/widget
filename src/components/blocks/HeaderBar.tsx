import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { Avatar } from '../base/Avatar';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  controls?: React.ReactNode;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ title, subtitle, onClose, controls }) => {
  return (
    <Flex
      align='center'
      justify='between'
      paddingX='lg'
      paddingY='md'
      border='bottom'
      shrink={false}
      elevation='section'
    >
      <Flex align='center' gap='md' minWidth='0' grow>
        <Avatar src={MarketrixIcon} alt='' size='md' rounded='theme' elevation='card' />
        <Stack minWidth='0'>
          <Text size='sm' weight='semibold' truncate leading='tight'>
            {title}
          </Text>
          {subtitle != null && (
            <Text as='p' size='xs' variant='muted' truncate>
              {subtitle}
            </Text>
          )}
        </Stack>
      </Flex>

      <Flex align='center' gap='xs' shrink={false}>
        {controls}
        <IconButton size='sm' label='Close' onClick={onClose}>
          <Icon name='close' size={16} />
        </IconButton>
      </Flex>
    </Flex>
  );
};

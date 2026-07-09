import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { controlSizeStyles } from '../../design-system/component-tokens';
import { Avatar } from '../base/Avatar';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Stack } from '../base/Stack';
import { Text } from '../base/Text';

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  minimized?: boolean;
  onClose: () => void;
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
        <IconButton variant='toolbar' size='sm' label='Close' onClick={onClose}>
          <Icon name='close' size={16} />
        </IconButton>
      </Flex>
    </Flex>
  );
};

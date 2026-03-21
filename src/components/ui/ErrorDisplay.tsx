import React from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { LAYER_TOKENS } from '../../design-system/layers';
import { Avatar } from '../base/Avatar';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { IconButton } from '../base/IconButton';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
  /** Optional retry for transient failures (explicit recovery per plan 7.4) */
  onRetry?: () => void;
  position?: 'bottom_left' | 'bottom_right' | 'top_left' | 'top_right';
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onClose, onRetry, position = 'bottom_left' }) => {
  const positionStyle =
    position === 'bottom_left' || position === 'top_left' || !position ? { left: '0' } : { right: '0' };
  const verticalStyle = position.includes('top') ? { top: '20px' } : { bottom: '90px' };
  return (
    <Surface
      className='fixed'
      style={{
        zIndex: LAYER_TOKENS.toast + 10,
        ...verticalStyle,
        ...positionStyle,
        maxWidth: '420px',
      }}
    >
      <Flex
        className='items-center gap-2.5 rounded-full shadow-lg'
        style={{
          padding: '8px 12px 8px 8px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
        }}
      >
        {/* Marketrix Logo */}
        <Avatar src={MarketrixIcon} alt='' size={28} className='flex-shrink-0' style={{ borderRadius: '50%' }} />

        {/* Error Message */}
        <Text
          as='span'
          className='text-red-700 font-medium flex-1 min-w-0 text-inherit'
          style={{
            fontSize: '13px',
            whiteSpace: onRetry ? 'normal' : 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {error}
        </Text>

        {onRetry && (
          <Button
            type='button'
            variant='ghost'
            onClick={() => {
              onRetry();
              onClose();
            }}
            className='flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-red-700 transition-colors hover:text-red-800'
            style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
            }}
            aria-label='Retry'
          >
            Retry
          </Button>
        )}

        <IconButton
          label='Close error'
          onClick={onClose}
          className='flex-shrink-0 text-red-400 hover:text-red-600'
          style={{ width: '20px', height: '20px', padding: '2px' }}
        >
          <Icon name='closeSmall' size={12} />
        </IconButton>
      </Flex>
    </Surface>
  );
};

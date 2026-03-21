import React from 'react';

import { addOpacity } from '../../utils/format';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Spinner } from '../base/Spinner';
import { Text } from '../base/Text';

interface ProgressLineProps {
  content: string;
  status?: 'running' | 'completed' | 'failed' | 'canceled' | 'pending';
  isWaitingForUser: boolean;
  accentColor: string;
  textColor: string;
  hideIcon?: boolean;
  textStyle?: 'default' | 'muted';
}

export const ProgressLine: React.FC<ProgressLineProps> = ({
  content,
  status = 'pending',
  isWaitingForUser,
  accentColor,
  textColor,
  hideIcon = false,
  textStyle = 'default',
}) => {
  // 'running' shows spinner, 'pending' shows static circle, others show status icons.

  const renderIcon = () => {
    switch (status) {
      case 'completed':
        return <Icon name='checkCircle' className='flex-shrink-0 mt-0.5' style={{ color: accentColor }} size={16} />;
      case 'failed':
        return (
          <Icon
            name='timesCircle'
            className='flex-shrink-0 mt-0.5'
            style={{ color: addOpacity(textColor, 0.65) }}
            size={16}
          />
        );
      case 'canceled':
        return (
          <Icon name='ban' className='flex-shrink-0 mt-0.5' style={{ color: addOpacity(textColor, 0.5) }} size={16} />
        );
      case 'running':
        // If waiting for user, we might want a different icon or just spinner?
        // The original code had specific logic for waiting for user.
        if (isWaitingForUser) {
          return (
            <Flex
              className='flex-shrink-0 mt-0.5 spinner-container'
              style={{
                width: '16px',
                height: '16px',
                position: 'relative',
              }}
            >
              <Flex
                className='spinner'
                style={{
                  width: '16px',
                  height: '16px',
                  border: `2px solid ${addOpacity(textColor, 0.2)}`,
                  borderTop: `2px solid ${accentColor}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </Flex>
          );
        }
        // Standard running spinner
        return <Spinner size='sm' className='flex-shrink-0 mt-0.5' style={{ color: accentColor }} />;
      case 'pending':
      default:
        // Static circle for pending/queued
        return (
          <Icon
            name='circle'
            className='flex-shrink-0 mt-0.5'
            style={{ color: addOpacity(textColor, 0.5) }}
            size={16}
          />
        );
    }
  };

  return (
    <Flex className='items-start gap-2'>
      {!hideIcon && renderIcon()}
      <Text
        as='span'
        className='flex-1 whitespace-pre-wrap text-xs font-inter font-medium leading-tight'
        style={{
          color: textStyle === 'muted' ? addOpacity(textColor, 0.5) : textColor,
        }}
      >
        {content}
      </Text>
    </Flex>
  );
};

import React, { type ReactNode } from 'react';

import { Flex, Icon, Spinner, Text } from '../base';

export interface ProgressStepProps {
  status: 'running' | 'completed' | 'failed' | 'canceled' | 'pending';
  children?: ReactNode;
  /** Override text — e.g. "Thinking..." or "Waiting for you..." */
  label?: string;
}

export const ProgressStep: React.FC<ProgressStepProps> = ({ status, children, label }) => {
  // When label is provided (ThinkingIndicator mode): Spinner + label text
  if (label) {
    return (
      <Flex className='items-center gap-1.5 py-0.5'>
        <Spinner className='flex-shrink-0' size='sm' />
        <Text as='span' className='text-[10px] font-inter font-normal' variant='faint'>
          {label}
        </Text>
      </Flex>
    );
  }

  const renderIcon = () => {
    switch (status) {
      case 'completed':
        return <Icon className='flex-shrink-0 mt-0.5 text-primary' name='checkCircle' size={16} />;
      case 'failed':
        return <Icon className='flex-shrink-0 mt-0.5 text-foreground-muted opacity-75' name='timesCircle' size={16} />;
      case 'canceled':
        return <Icon className='flex-shrink-0 mt-0.5 text-foreground-faint opacity-50' name='ban' size={16} />;
      case 'pending':
        return <Icon className='flex-shrink-0 mt-0.5 text-foreground-faint opacity-50' name='circle' size={16} />;
      case 'running':
      default:
        return <Spinner className='flex-shrink-0 mt-0.5 text-primary' size='sm' />;
    }
  };

  return (
    <Flex className='items-start gap-2'>
      {renderIcon()}
      <Text as='span' className='flex-1 whitespace-pre-wrap text-xs font-inter font-medium leading-tight' size='xs'>
        {children}
      </Text>
    </Flex>
  );
};

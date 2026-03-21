import React, { type ReactNode } from 'react';

import { Avatar, Button, Flex, Spinner, Stack, Text } from '../base';

export interface MessageRowActionProps {
  label: string;
  variant: 'primary' | 'secondary';
  onClick: () => void;
}

export interface MessageRowProps {
  sender: 'agent' | 'user' | 'system';
  content: ReactNode;
  logo?: string;
  timestamp?: string;
  attribution?: string;
  status?: 'running' | 'completed' | 'failed' | 'stopped';
  actions?: MessageRowActionProps[];
  screenAccess?: 'requested' | 'allowed' | 'denied';
  videoStream?: ReactNode;
}

function StatusIcon({ status }: { status: NonNullable<MessageRowProps['status']> }) {
  switch (status) {
    case 'completed':
      return (
        <svg
          aria-hidden='true'
          className='inline-block flex-shrink-0'
          fill='currentColor'
          height={14}
          style={{ color: 'var(--color-primary)' }}
          viewBox='0 0 512 512'
          width={14}
          xmlns='http://www.w3.org/2000/svg'
        >
          <path d='M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z' />
        </svg>
      );
    case 'failed':
      return (
        <svg
          aria-hidden='true'
          className='inline-block flex-shrink-0'
          fill='currentColor'
          height={14}
          style={{ color: 'var(--color-primary)', opacity: 0.75 }}
          viewBox='0 0 512 512'
          width={14}
          xmlns='http://www.w3.org/2000/svg'
        >
          <path d='M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z' />
        </svg>
      );
    case 'stopped':
      return (
        <svg
          aria-hidden='true'
          className='inline-block flex-shrink-0'
          fill='currentColor'
          height={14}
          style={{ color: 'var(--color-primary)', opacity: 0.5 }}
          viewBox='0 0 512 512'
          width={14}
          xmlns='http://www.w3.org/2000/svg'
        >
          <path d='M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z' />
        </svg>
      );
    case 'running':
    default:
      return <Spinner className='flex-shrink-0' size='sm' style={{ color: 'var(--color-primary)' }} />;
  }
}

export const MessageRow: React.FC<MessageRowProps> = ({
  sender,
  content,
  logo,
  timestamp,
  attribution,
  status,
  actions,
  screenAccess,
  videoStream,
}) => {
  if (sender === 'system') {
    return (
      <Flex className='justify-center items-center py-0'>
        <Text as='span' className='text-[10px] font-inter font-normal' variant='faint'>
          {content}
        </Text>
      </Flex>
    );
  }

  const isUser = sender === 'user';

  return (
    <Stack className='group mt-[10px]'>
      <Flex className='items-start gap-1 w-full flex-row'>
        {/* Logo or spacer — always on left */}
        <Flex className='flex-shrink-0 w-8 h-8 bg-transparent'>
          {!isUser && logo && (
            <Avatar
              alt='Agent'
              className='agent-logo-img shadow-[var(--shadow)] rounded-[var(--radius)] block object-cover bg-transparent'
              size='md'
              src={logo}
              style={{ border: 'none', outline: 'none' }}
            />
          )}
        </Flex>

        {/* Message bubble */}
        <Stack
          className={[
            'flex-1 relative',
            videoStream ? 'p-0' : 'px-2.5 py-2',
            !isUser ? 'rounded-[var(--radius)] shadow-[0_1px_4px_rgba(0,0,0,0.1)]' : 'border',
            isUser
              ? 'rounded-l-[var(--radius)] rounded-tr-[var(--radius)] rounded-br-[var(--radius)] bg-primary text-primary-foreground border-primary'
              : 'text-foreground border-transparent',
          ].join(' ')}
          style={{ maxWidth: isUser ? 'calc(100% - 40px)' : '280px' }}
        >
          {/* Video stream — edge-to-edge */}
          {videoStream}

          {/* Content */}
          {!videoStream && content}

          {/* Screen access action buttons */}
          {screenAccess === 'requested' && (
            <Flex className='mt-1.5 pt-0.5 gap-2'>
              {actions?.map((action, i) => (
                <Button
                  key={i}
                  className='flex items-center justify-center text-sm font-medium h-[26px] min-w-[65px] rounded-[22px]'
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    action.onClick();
                  }}
                  size='sm'
                  style={
                    action.variant === 'primary'
                      ? { backgroundColor: '#111827', color: '#fff', border: 'none' }
                      : { backgroundColor: '#f3f4f6', color: '#111827' }
                  }
                  type='button'
                  variant={action.variant}
                >
                  {action.label}
                </Button>
              ))}
            </Flex>
          )}

          {/* Screen access handled state */}
          {screenAccess === 'allowed' && (
            <Text as='div' className='mt-0.5 text-xs font-medium italic' variant='faint'>
              Sure
            </Text>
          )}
          {screenAccess === 'denied' && (
            <Text as='div' className='mt-0.5 text-xs font-medium italic' variant='faint'>
              Check HTML Instead
            </Text>
          )}

          {/* Actions (non-screen-access) */}
          {!screenAccess && actions && actions.length > 0 && (
            <Flex className='mt-1.5 pt-0.5 gap-2'>
              {actions.map((action, i) => (
                <Button
                  key={i}
                  className='flex items-center justify-center text-sm font-medium h-[26px] min-w-[65px] rounded-[22px]'
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    action.onClick();
                  }}
                  size='sm'
                  type='button'
                  variant={action.variant}
                >
                  {action.label}
                </Button>
              ))}
            </Flex>
          )}

          {/* Task status icon — bottom-right of agent bubble */}
          {!isUser && status && (
            <Flex className='absolute bottom-1 right-1 items-center justify-center'>
              <StatusIcon status={status} />
            </Flex>
          )}
        </Stack>
      </Flex>

      {/* Attribution line for agent messages */}
      {!isUser && attribution && (
        <Text as='div' className='text-[11px] mt-1 ml-9' variant='muted'>
          {attribution}
          {timestamp ? ` • ${timestamp}` : ''}
        </Text>
      )}
      {!isUser && !attribution && timestamp && (
        <Text as='div' className='text-[11px] mt-1 ml-9' variant='muted'>
          {timestamp}
        </Text>
      )}

      {/* Timestamp for user messages */}
      {isUser && timestamp && (
        <Flex className='justify-end mt-0.5 mr-1'>
          <Text as='span' className='text-[10px] font-inter font-normal' variant='faint'>
            {timestamp}
          </Text>
        </Flex>
      )}
    </Stack>
  );
};

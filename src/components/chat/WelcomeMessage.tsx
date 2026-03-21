import React, { useRef } from 'react';

import MarketrixIcon from '../../assets/marketrix-icon.svg';
import { formatMessageTime } from '../../utils/format';
import { Avatar, Flex, Stack, Text } from '../base';

interface WelcomeMessageProps {
  greeting: string;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ greeting }) => {
  const mountTimeRef = useRef(new Date());

  return (
    <Stack role='article' aria-roledescription='message' aria-label='Agent says…'>
      <Flex align='start' gap='xs'>
        {/* Agent avatar */}
        <Flex shrink={false} style={{ width: '32px', height: '32px', backgroundColor: 'transparent' }}>
          <Avatar
            src={MarketrixIcon}
            alt='Marketrix AI'
            size='md'
            rounded='theme'
            style={{
              border: 'none',
              outline: 'none',
              display: 'block',
              objectFit: 'cover',
              backgroundColor: 'transparent',
            }}
          />
        </Flex>

        {/* Message bubble — matches MessageItem agent style */}
        <Stack
          grow
          style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            border: '1px solid transparent',
            color: 'var(--foreground)',
          }}
        >
          <Text
            as='div'
            size='xs'
            weight='medium'
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 'tight' }}
          >
            {greeting}
          </Text>
        </Stack>
      </Flex>
      {/* Attribution — matches MessageItem */}
      <Text as='div' variant='muted' style={{ fontSize: '11px', marginTop: '4px', marginLeft: '36px' }}>
        Marketrix • AI Agent • {formatMessageTime(mountTimeRef.current)}
      </Text>
    </Stack>
  );
};

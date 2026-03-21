import React from 'react';

import { formatMessageTime } from '../../utils/format';
import { Flex, Stack, Text } from '../base';

interface WelcomeMessageProps {
  greeting: string;
  settings: {
    widget_shadow: string;
    widget_border_radius: string;
    widget_text_color: string;
    widget_border_color: string;
    widget_secondary_color: string;
  };
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ greeting, settings }) => {
  return (
    <Stack key='welcome-message' justify='start' marginTop='md'>
      <Flex align='start'>
        {/* Message bubble */}
        <Stack
          grow
          paddingX='sm'
          paddingY='md'
          rounded='lg'
          shadow
          border
          style={{
            backgroundColor: '#ffffff',
            backgroundImage: 'none',
            color: settings.widget_text_color,
            borderColor: settings.widget_border_color,
          }}
        >
          {/* Message content */}
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
      {/* Timestamp below card */}
      <Flex justify='end' style={{ marginTop: '2px' }}>
        <Text as='span' style={{ fontSize: '10px', color: `${settings.widget_text_color}99` }}>
          {formatMessageTime(new Date())}
        </Text>
      </Flex>
    </Stack>
  );
};

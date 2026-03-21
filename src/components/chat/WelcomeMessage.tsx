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
    <Stack key='welcome-message' className='group justify-start mt-2'>
      <Flex className='items-start flex-row'>
        {/* Message bubble */}
        <Stack
          className='flex-1 px-2.5 py-2 rounded-lg shadow-sm border'
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
            className='text-inherit text-xs font-inter font-medium leading-tight whitespace-pre-wrap break-words'
          >
            {greeting}
          </Text>
        </Stack>
      </Flex>
      {/* Timestamp below card */}
      <Flex className='justify-end mt-0.5'>
        <Text
          as='span'
          className='text-inherit text-[10px] font-inter font-normal'
          style={{ color: `${settings.widget_text_color}99` }}
        >
          {formatMessageTime(new Date())}
        </Text>
      </Flex>
    </Stack>
  );
};

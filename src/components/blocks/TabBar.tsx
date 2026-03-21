import React from 'react';

import { Button, Flex, Icon, type IconName, Indicator, Text } from '../base';

export interface TabBarProps {
  tabs: { id: string; icon: IconName; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, active, onChange }) => {
  return (
    <Flex
      role='tablist'
      className='items-center justify-around flex-shrink-0 h-12 border-t border-border'
      style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}
    >
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <Button
            key={tab.id}
            role='tab'
            aria-selected={isActive}
            aria-controls={`view-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            variant='bare'
            className={`relative flex-col gap-0.5 flex-1 h-full min-w-0 transition-[color,opacity] duration-150 ${
              isActive ? 'text-primary font-semibold' : 'text-foreground-muted font-normal'
            }`}
          >
            {isActive && (
              <Text as='span' className='absolute top-0 left-1/4 right-1/4 text-inherit'>
                <Indicator variant='bar' color='accent' />
              </Text>
            )}
            <Text as='span' className='flex-shrink-0 text-inherit' aria-hidden='true'>
              <Icon name={tab.icon} size={20} />
            </Text>
            <Text as='span' size='xs' className='truncate w-full text-center text-inherit'>
              {tab.label}
            </Text>
          </Button>
        );
      })}
    </Flex>
  );
};

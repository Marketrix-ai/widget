import React from 'react';

import type { WidgetView } from '../../types';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Indicator } from '../base/Indicator';
import { Text } from '../base/Text';

export interface TabItem {
  id: WidgetView;
  label: string;
  icon: React.ReactNode;
}

interface TabBarProps {
  activeView: WidgetView;
  onViewChange: (view: WidgetView) => void;
  tabs: TabItem[];
}

export const TabBar: React.FC<TabBarProps> = ({ activeView, onViewChange, tabs }) => {
  return (
    <Flex
      role='tablist'
      className='items-center justify-around flex-shrink-0 h-12 border-t border-border'
      style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}
    >
      {tabs.map(tab => {
        const isActive = activeView === tab.id;
        return (
          <Button
            key={tab.id}
            role='tab'
            aria-selected={isActive}
            aria-controls={`view-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onViewChange(tab.id)}
            variant='ghost'
            className={`relative flex-col gap-0.5 flex-1 py-2 min-w-0 border-0 rounded-none min-h-0 px-0 transition-[color,opacity] duration-150 ${
              isActive ? 'text-primary font-semibold' : 'text-foreground-muted font-normal'
            }`}
          >
            {isActive && (
              <Text as='span' className='absolute top-0 left-1/4 right-1/4 text-inherit'>
                <Indicator variant='bar' color='accent' />
              </Text>
            )}
            <Text as='span' className='flex-shrink-0 text-inherit' aria-hidden='true'>
              {tab.icon}
            </Text>
            <Text as='span' className='text-xs truncate w-full text-center text-inherit'>
              {tab.label}
            </Text>
          </Button>
        );
      })}
    </Flex>
  );
};

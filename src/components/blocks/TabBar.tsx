import React from 'react';

import { controlSizeStyles } from '../../design-system/component-tokens';
import { Button, Flex, Icon, type IconName, Indicator, Text } from '../base';

export interface TabBarProps {
  tabs: { id: string; icon: IconName; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, active, onChange }) => {
  return (
    <Flex role='tablist' align='center' justify='around' shrink={false} border='top' style={controlSizeStyles.tabBar}>
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
            active={isActive}
            stacked
            variant='tab'
          >
            {isActive && (
              <Text as='span' inheritColor style={{ position: 'absolute', top: 0, left: '25%', right: '25%' }}>
                <Indicator variant='bar' color='accent' />
              </Text>
            )}
            <Text as='span' inheritColor aria-hidden='true'>
              <Icon name={tab.icon} size={20} />
            </Text>
            <Text as='span' size='xs' align='center' inheritColor truncate block>
              {tab.label}
            </Text>
          </Button>
        );
      })}
    </Flex>
  );
};

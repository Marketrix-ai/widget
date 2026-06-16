import React from 'react';

import { controlSizeStyles } from '../../design-system/component-tokens';
import type { WidgetView } from '../../types';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import type { IconName } from '../base/icons';
import { Indicator } from '../base/Indicator';
import { Text } from '../base/Text';

const TAB_DEFS: { id: WidgetView; icon: IconName; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'chat', icon: 'chat', label: 'Chat' },
];

export interface ShellTabBarProps {
  activeView: WidgetView;
  onChange: (view: WidgetView) => void;
}

export const ShellTabBar: React.FC<ShellTabBarProps> = ({ activeView, onChange }) => {
  return (
    <Flex role='tablist' align='center' justify='around' shrink={false} border='top' style={controlSizeStyles.tabBar}>
      {TAB_DEFS.map(tab => {
        const isActive = activeView === tab.id;
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

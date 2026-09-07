import { Tabs } from '@base-ui/react/tabs';
import React from 'react';

import { TAB_BAR_HEIGHT } from '../../design-system/component-tokens';
import type { WidgetView } from '../../types';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import type { IconName } from '../base/icons';
import { Text } from '../base/Text';

const TAB_DEFS: { id: WidgetView; icon: IconName; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'chat', icon: 'chat', label: 'Chat' },
];

/** Selection, roles, ids and arrow-key navigation come from Tabs.Root — see MessengerShell. */
export const ShellTabBar: React.FC = () => (
  <Tabs.List
    render={<Flex align='center' justify='around' shrink={false} border='top' />}
    style={{ height: TAB_BAR_HEIGHT }}
  >
    {TAB_DEFS.map(tab => (
      <Tabs.Tab key={tab.id} value={tab.id} render={<Button stacked variant='tab' />}>
        {/* Always rendered; `[data-selected]` reveals it, so nothing here tracks selection. */}
        <span className='mtx-tab-underline' />
        <Text as='span' inheritColor aria-hidden='true'>
          <Icon name={tab.icon} size={20} />
        </Text>
        <Text as='span' size='xs' align='center' inheritColor truncate block>
          {tab.label}
        </Text>
      </Tabs.Tab>
    ))}
  </Tabs.List>
);

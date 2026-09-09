/**
 * The Home/Chat tab strip pinned to the bottom of `MessengerShell`. `TAB_DEFS` is the ordered
 * (view id, icon, label) table it renders; `ShellTabBar` maps that table to `Tabs.Tab` buttons inside
 * a `Tabs.List` fixed at `TAB_BAR_HEIGHT`.
 *
 * It holds no state of its own: selection, roles, ids and arrow-key navigation all come from the
 * controlled `Tabs.Root` in `MessengerShell`, and the `.mtx-tab-underline` span is always rendered —
 * `index.css` reveals it off the selected tab's `aria-selected='true'`, so nothing here reads or
 * tracks which tab is active.
 */
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

export const ShellTabBar: React.FC = () => (
  <Tabs.List
    render={<Flex align='center' justify='around' shrink={false} border='top' />}
    style={{ height: TAB_BAR_HEIGHT }}
  >
    {TAB_DEFS.map(tab => (
      <Tabs.Tab key={tab.id} value={tab.id} render={<Button stacked variant='tab' />}>
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

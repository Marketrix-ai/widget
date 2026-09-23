/**
 * The Home/Chat tab strip pinned to the bottom of `MessengerShell`. `TAB_DEFS` gives each view its icon
 * and label; `ShellTabBar` renders one `Tabs.Tab` per view, in `WIDGET_VIEWS` order, inside a `Tabs.List`
 * fixed at `TAB_BAR_HEIGHT`.
 *
 * It holds no state of its own: selection, roles, ids and arrow-key navigation all come from the
 * controlled `Tabs.Root` in `MessengerShell`, and the `.mtx-tab-underline` span is always rendered —
 * `index.css` reveals it off the selected tab's `aria-selected='true'`, so nothing here reads or
 * tracks which tab is active.
 */
import { Tabs } from '@base-ui/react/tabs';
import React from 'react';

import { TAB_BAR_HEIGHT } from '../../design-system/component-tokens';
import { WIDGET_VIEWS, type WidgetView } from '../../types';
import { Button } from '../base/Button';
import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import type { IconName } from '../base/icons';
import { Text } from '../base/Text';

const TAB_DEFS: Record<WidgetView, { icon: IconName; label: string }> = {
  home: { icon: 'home', label: 'Home' },
  chat: { icon: 'chat', label: 'Chat' },
};

export const ShellTabBar: React.FC = () => (
  <Tabs.List
    render={<Flex align='center' justify='around' shrink={false} border='top' />}
    style={{ height: TAB_BAR_HEIGHT }}
  >
    {WIDGET_VIEWS.map(view => (
      <Tabs.Tab key={view} value={view} render={<Button stacked variant='tab' />}>
        <span className='mtx-tab-underline' />
        <Text as='span' inheritColor aria-hidden='true'>
          <Icon name={TAB_DEFS[view].icon} size={20} />
        </Text>
        <Text as='span' size='xs' align='center' inheritColor truncate block>
          {TAB_DEFS[view].label}
        </Text>
      </Tabs.Tab>
    ))}
  </Tabs.List>
);

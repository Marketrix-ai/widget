import React from 'react';

import type { WidgetView } from '../../types';
import { TabBar } from '../blocks/TabBar';

const TAB_DEFS = [
  { id: 'home' as const, icon: 'home' as const, label: 'Home' },
  { id: 'chat' as const, icon: 'chat' as const, label: 'Chat' },
];

export interface ShellTabBarProps {
  activeView: WidgetView;
  onChange: (view: WidgetView) => void;
}

export const ShellTabBar: React.FC<ShellTabBarProps> = ({ activeView, onChange }) => {
  const handleChange = (id: string) => onChange(id as WidgetView);
  return <TabBar tabs={TAB_DEFS} active={activeView} onChange={handleChange} />;
};

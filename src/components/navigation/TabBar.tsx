import React from 'react';

import type { WidgetView } from '../../types';
import { Indicator } from '../base/Indicator';

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
    <div
      role='tablist'
      className='flex items-center justify-around flex-shrink-0 h-12 border-t border-border'
      style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}
    >
      {tabs.map(tab => {
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            type='button'
            role='tab'
            aria-selected={isActive}
            aria-controls={`view-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onViewChange(tab.id)}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-[color,opacity] duration-150 min-w-0 ${
              isActive ? 'text-primary font-semibold' : 'text-foreground-muted font-normal'
            }`}
          >
            {isActive && (
              <span className='absolute top-0 left-1/4 right-1/4'>
                <Indicator variant='bar' color='accent' />
              </span>
            )}
            <span className='flex-shrink-0' aria-hidden>
              {tab.icon}
            </span>
            <span className='text-xs truncate w-full text-center'>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
